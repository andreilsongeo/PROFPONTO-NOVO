
import React, { useState, useEffect } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
import { AppState } from '../types';
import { firebaseConfig } from '../firebaseConfig';

interface Props {
  state: AppState;
  currentConfigKey: string;
  onImport: (data: AppState) => void;
  onClose: () => void;
}

let firebaseApp: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

const initFirebase = () => {
    if (!firebaseApp) {
        try {
            firebaseApp = initializeApp(firebaseConfig);
            auth = getAuth(firebaseApp);
            db = getFirestore(firebaseApp);
            return true;
        } catch (e) {
            console.error("Firebase init error", e);
            return false;
        }
    }
    return !!firebaseApp;
};

export const CloudSyncModal: React.FC<Props> = ({ state, currentConfigKey, onImport, onClose }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
      if(initFirebase()) {
          setIsInitialized(true);
          const authInstance = getAuth(firebaseApp);
          const unsubscribe = onAuthStateChanged(authInstance, (u) => setUser(u));
          return () => unsubscribe();
      } else {
          setStatus("Erro ao inicializar conexão com o Firebase.");
      }
  }, []);

  const handleLogin = async () => {
      if (!auth) return;
      try {
          await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e: any) { 
          console.error(e); 
          setStatus("Erro no login: " + e.message); 
      }
  };

  const handleLogout = async () => {
      if (!auth) return;
      await signOut(auth);
      setUser(null);
  };

  const handleUpload = async () => {
      if (!db || !user) return;
      setStatus("Enviando...");
      try {
          // Salva na coleção 'schools', documento = ID do usuário
          const userDocRef = doc(db, "schools", user.uid);
          // Usamos setDoc com merge para não apagar outros anos letivos se houver
          await setDoc(userDocRef, { [currentConfigKey]: state }, { merge: true });
          setStatus("Sucesso! Dados salvos na nuvem.");
      } catch (e: any) {
          console.error(e);
          setStatus("Erro ao enviar: " + e.message);
      }
  };

  const handleDownload = async () => {
      if (!db || !user) return;
      setStatus("Baixando...");
      try {
          const userDocRef = doc(db, "schools", user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              const remoteState = data[currentConfigKey];
              if (remoteState) {
                  if (window.confirm("Isso substituirá os dados locais pelos dados da nuvem. Continuar?")) {
                      onImport(remoteState);
                      setStatus("Dados restaurados com sucesso!");
                  } else {
                      setStatus("Operação cancelada.");
                  }
              } else {
                  setStatus(`Nenhum dado encontrado para "${currentConfigKey.replace('ano_letivo_','')}" na nuvem.`);
              }
          } else {
              setStatus("Nenhum backup encontrado para este usuário.");
          }
      } catch (e: any) {
          console.error(e);
          setStatus("Erro ao baixar: " + e.message);
      }
  };

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
              <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">☁️ Sincronização em Nuvem</h3>
                  <button onClick={onClose} className="text-white hover:text-indigo-200 text-xl">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                  {!isInitialized ? (
                      <div className="text-center py-4">
                          <p className="text-gray-600">Inicializando conexão...</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {!user ? (
                              <div className="text-center py-4 space-y-4">
                                  <p className="text-sm text-gray-600">Faça login para salvar seus dados na nuvem.</p>
                                  <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-bold shadow transition flex justify-center items-center gap-2">
                                      <span className="text-lg">G</span> Fazer Login com Google
                                  </button>
                              </div>
                          ) : (
                              <div className="space-y-6">
                                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                                      <div className="flex items-center gap-3">
                                          {user.photoURL ? (
                                              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
                                          ) : (
                                              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">{user.email?.charAt(0).toUpperCase()}</div>
                                          )}
                                          <div className="flex flex-col">
                                              <span className="text-xs text-gray-500">Logado como</span>
                                              <span className="text-sm font-bold text-gray-700">{user.email}</span>
                                          </div>
                                      </div>
                                      <button onClick={handleLogout} className="text-xs text-red-600 hover:underline font-medium border border-red-200 px-2 py-1 rounded hover:bg-red-50">Sair</button>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                      <button onClick={handleUpload} className="bg-green-600 text-white py-4 rounded-lg font-bold flex flex-col items-center hover:bg-green-700 transition shadow border-b-4 border-green-800 active:border-0 active:mt-1">
                                          <span className="text-2xl mb-1">⬆️</span>
                                          <span>Enviar p/ Nuvem</span>
                                      </button>
                                      <button onClick={handleDownload} className="bg-blue-600 text-white py-4 rounded-lg font-bold flex flex-col items-center hover:bg-blue-700 transition shadow border-b-4 border-blue-800 active:border-0 active:mt-1">
                                          <span className="text-2xl mb-1">⬇️</span>
                                          <span>Baixar da Nuvem</span>
                                      </button>
                                  </div>
                                  <div className="bg-indigo-50 p-3 rounded text-center">
                                      <p className="text-xs text-indigo-800">
                                          Sincronizando configuração: <br/>
                                          <strong className="text-sm">{currentConfigKey.replace('ano_letivo_','Ano ')}</strong>
                                      </p>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
                  {status && (
                      <div className={`p-3 text-center text-sm rounded border ${status.includes('Sucesso') ? 'bg-green-50 text-green-800 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
                          {status}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
};
