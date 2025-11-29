
import React, { useState, useEffect } from 'react';
import { AppState } from './types';
import { loadState, saveState, listConfigs, createConfig } from './services/storageService';
import { CalendarTab } from './components/CalendarTab';
import { ResourcesTab } from './components/ResourcesTab';
import { ScheduleTab } from './components/ScheduleTab';
import { ReportsTab } from './components/ReportsTab';
import { InstitutionModal } from './components/InstitutionModal';
import { DataManagementModal } from './components/DataManagementModal';
import { CloudSyncModal } from './components/CloudSyncModal';

const App: React.FC = () => {
  const [currentConfigKey, setCurrentConfigKey] = useState<string>('ano_letivo_2025');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar'|'resources'|'schedule'|'reports'>('calendar');
  
  // Modals State
  const [isInstModalOpen, setInstModalOpen] = useState(false);
  const [isNewYearModalOpen, setNewYearModalOpen] = useState(false);
  const [isDataModalOpen, setDataModalOpen] = useState(false);
  const [isCloudModalOpen, setCloudModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState("");
  
  // Lista de configurações disponíveis (Estados)
  const [availableConfigs, setAvailableConfigs] = useState<string[]>([]);

  // Carregar lista de configs ao iniciar
  useEffect(() => {
    setAvailableConfigs(listConfigs());
  }, []);

  // Initialize App State
  useEffect(() => {
    const cfgs = listConfigs();
    if (cfgs.length === 0) {
        createConfig('2025');
        setAvailableConfigs(listConfigs());
    }
    setAppState(loadState(currentConfigKey));
  }, [currentConfigKey]);

  // Persistence
  const updateState = (updates: Partial<AppState>) => {
    if (!appState) return;
    const newState = { ...appState, ...updates };
    setAppState(newState);
    saveState(currentConfigKey, newState);
  };

  // Import Full State logic
  const handleFullImport = (importedState: AppState) => {
      setAppState(importedState);
      saveState(currentConfigKey, importedState);
  };

  const handleCreateConfig = () => {
      if(newYearName.trim()) {
          // Pass current appState to inherit Institution/Teachers/Subjects
          const key = createConfig(newYearName, appState || undefined);
          setAvailableConfigs(listConfigs()); // Atualiza a lista dropdown
          setCurrentConfigKey(key); // Muda para o novo ano
          setNewYearModalOpen(false);
          setNewYearName("");
      }
  };

  if (!appState) return <div className="flex justify-center items-center h-screen">Carregando...</div>;

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
                <h1 className="text-xl font-bold text-gray-800 hidden sm:block">PROFponto</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                <select 
                    value={currentConfigKey} 
                    onChange={e => setCurrentConfigKey(e.target.value)}
                    className="border border-gray-300 rounded-md py-1 px-2 sm:px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[120px] sm:max-w-xs cursor-pointer"
                >
                    {availableConfigs.map(k => (
                        <option key={k} value={k}>{k.replace('ano_letivo_', 'Ano ')}</option>
                    ))}
                </select>
                
                <button 
                    onClick={() => setNewYearModalOpen(true)} 
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-medium text-gray-600 border border-gray-300 transition"
                    title="Criar novo Ano Letivo"
                >
                    + Novo
                </button>

                <button 
                    onClick={() => setDataModalOpen(true)} 
                    className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded font-medium transition flex items-center gap-1"
                    title="Exportar/Importar Backup"
                >
                    💾 Dados
                </button>

                <button 
                    onClick={() => setCloudModalOpen(true)} 
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded font-medium transition flex items-center gap-1"
                    title="Sincronizar com Firebase"
                >
                    ☁️ Nuvem
                </button>

                <button onClick={() => setInstModalOpen(true)} className="text-indigo-600 font-medium text-sm hover:underline ml-2">
                    Instituição
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8 overflow-x-auto">
          <nav className="-mb-px flex space-x-8 min-w-max">
            {[
              { id: 'calendar', label: 'Calendário' },
              { id: 'resources', label: 'Professores & Turmas' },
              { id: 'schedule', label: 'Grade de Horários' },
              { id: 'reports', label: 'Gerar Relatórios' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id 
                    ? 'border-indigo-500 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="animate-fade-in">
            {activeTab === 'calendar' && <CalendarTab state={appState} updateState={updateState} />}
            {activeTab === 'resources' && <ResourcesTab state={appState} updateState={updateState} />}
            {activeTab === 'schedule' && <ScheduleTab state={appState} updateState={updateState} />}
            {activeTab === 'reports' && <ReportsTab state={appState} />}
        </div>
      </main>

      {/* Institution Modal */}
      {isInstModalOpen && (
          <InstitutionModal 
            data={appState.instituicao} 
            onClose={() => setInstModalOpen(false)}
            onSave={(data) => {
                updateState({ instituicao: data });
                setInstModalOpen(false);
            }} 
          />
      )}

      {/* Data Management Modal */}
      {isDataModalOpen && (
          <DataManagementModal 
            state={appState}
            onClose={() => setDataModalOpen(false)}
            onImport={handleFullImport}
          />
      )}

      {/* Cloud Sync Modal */}
      {isCloudModalOpen && (
          <CloudSyncModal 
            state={appState}
            currentConfigKey={currentConfigKey}
            onClose={() => setCloudModalOpen(false)}
            onImport={handleFullImport}
          />
      )}

      {/* New Year Config Modal */}
      {isNewYearModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                      <h3 className="font-bold text-gray-700">Novo Ano Letivo</h3>
                      <button onClick={() => setNewYearModalOpen(false)} className="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
                  </div>
                  <div className="p-6">
                      <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                          Os dados da instituição, professores e disciplinas serão copiados do ano atual para facilitar. Você também pode usar a opção "Dados" para importar um backup de outro ano.
                      </p>
                      <label className="block text-xs font-bold text-gray-500 mb-2">Nome do Ano (ex: 2026)</label>
                      <input 
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-200 outline-none mb-4"
                          value={newYearName}
                          onChange={(e) => setNewYearName(e.target.value)}
                          placeholder="2026"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateConfig()}
                      />
                      <div className="flex justify-end gap-2">
                          <button onClick={() => setNewYearModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded">Cancelar</button>
                          <button onClick={handleCreateConfig} className="px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700">Criar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
