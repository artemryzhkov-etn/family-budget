// Конфігурація Firebase.
// Скопіюйте сюди значення з консолі Firebase:
// Project settings -> General -> Your apps -> SDK setup and configuration -> Config
// Це НЕ секрети — вони публічні за задумом Firebase; доступ до даних обмежують
// правила Firestore (файл firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyCkx8EvJi12Eo435ACrSsVBvd5oaoSImKE",
  authDomain: "family-budget-e9acf.firebaseapp.com",
  projectId: "family-budget-e9acf",
  storageBucket: "family-budget-e9acf.firebasestorage.app",
  messagingSenderId: "301980476747",
  appId: "1:301980476747:web:b5b7a81d9c07f9be85f4ce"
};

export function isConfigured(): boolean {
  return !Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_ME'));
}
