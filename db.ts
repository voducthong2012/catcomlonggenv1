
import { GeneratedImage, Category } from './types';

const DB_NAME = 'CatcomDB';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const STORE_CATEGORIES = 'categories';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve();
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject("Could not open database");
    };

    request.onsuccess = (event) => {
      dbInstance = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Create Images Store
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }

      // Create Categories Store
      // We store categories as a single object or list, but creating a store allows flexibility
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
    };
  });
};

// --- IMAGES OPERATIONS ---

export const getAllImages = async (): Promise<GeneratedImage[]> => {
  if (!dbInstance) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_IMAGES], 'readonly');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveImageToDB = async (image: GeneratedImage): Promise<void> => {
  if (!dbInstance) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.put(image); // put handles both add and update

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteImageFromDB = async (id: string): Promise<void> => {
  if (!dbInstance) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- CATEGORIES OPERATIONS ---

export const getAllCategories = async (): Promise<Category[]> => {
  if (!dbInstance) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_CATEGORIES], 'readonly');
    const store = transaction.objectStore(STORE_CATEGORIES);
    const request = store.getAll();

    request.onsuccess = () => {
        // If empty, return default
        const result = request.result || [];
        resolve(result.length > 0 ? result : []);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveCategoryToDB = async (category: Category): Promise<void> => {
  if (!dbInstance) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance!.transaction([STORE_CATEGORIES], 'readwrite');
    const store = transaction.objectStore(STORE_CATEGORIES);
    const request = store.put(category);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteCategoryFromDB = async (id: string): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance!.transaction([STORE_CATEGORIES], 'readwrite');
      const store = transaction.objectStore(STORE_CATEGORIES);
      const request = store.delete(id);
  
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
};

// --- BULK OPERATIONS (For Migration/Import) ---

export const bulkSaveImages = async (images: GeneratedImage[]): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_IMAGES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGES);
        
        images.forEach(img => store.put(img));
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const bulkSaveCategories = async (categories: Category[]): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_CATEGORIES], 'readwrite');
        const store = transaction.objectStore(STORE_CATEGORIES);
        
        categories.forEach(cat => store.put(cat));
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const clearDatabase = async (): Promise<void> => {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance!.transaction([STORE_IMAGES, STORE_CATEGORIES], 'readwrite');
        transaction.objectStore(STORE_IMAGES).clear();
        transaction.objectStore(STORE_CATEGORIES).clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const persistStorage = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persisted storage granted: ${isPersisted}`);
    return isPersisted;
  }
  return false;
};
