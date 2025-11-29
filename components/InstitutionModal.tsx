import React, { useState } from 'react';
import { InstitutionData } from '../types';

interface Props {
  data: InstitutionData;
  onSave: (data: InstitutionData) => void;
  onClose: () => void;
}

export const InstitutionModal: React.FC<Props> = ({ data, onSave, onClose }) => {
  const [formData, setFormData] = useState<InstitutionData>({ ...data });

  const handleChange = (field: keyof InstitutionData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if(ev.target?.result) handleChange('logo', ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Dados da Instituição</h2>
          <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* General */}
          <section className="space-y-4">
            <h3 className="font-bold text-indigo-600 border-b pb-1">Identificação</h3>
            <div>
              <label className="block text-xs font-bold text-gray-500">Nome da Escola</label>
              <input className="w-full border p-2 rounded" value={formData.nome} onChange={e => handleChange('nome', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500">Endereço</label>
              <input className="w-full border p-2 rounded" value={formData.endereco} onChange={e => handleChange('endereco', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-bold text-gray-500">Telefone</label>
                <input className="w-full border p-2 rounded" value={formData.telefone} onChange={e => handleChange('telefone', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Email</label>
                <input className="w-full border p-2 rounded" value={formData.email} onChange={e => handleChange('email', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Management */}
          <section className="space-y-4">
            <h3 className="font-bold text-indigo-600 border-b pb-1">Gestão</h3>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-bold text-gray-500">Diretor(a)</label>
                <input className="w-full border p-2 rounded" value={formData.diretor} onChange={e => handleChange('diretor', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Matrícula (Dir)</label>
                <input className="w-full border p-2 rounded" value={formData.matDiretor} onChange={e => handleChange('matDiretor', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Coordenador(a)</label>
                <input className="w-full border p-2 rounded" value={formData.coord} onChange={e => handleChange('coord', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500">Matrícula (Coord)</label>
                <input className="w-full border p-2 rounded" value={formData.matCoord} onChange={e => handleChange('matCoord', e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <label className="block text-xs font-bold text-gray-500 mb-2">Logo (Imagem)</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
            {formData.logo && <img src={formData.logo} alt="Preview" className="h-16 mt-2 object-contain" />}
          </section>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end">
            <button onClick={() => onSave(formData)} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">Salvar Dados</button>
        </div>
      </div>
    </div>
  );
};
