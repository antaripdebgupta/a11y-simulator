export const getFromStorage = async <T>(key: string): Promise<T | null> => {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  } catch (error) {
    console.error('Error getting from storage:', error);
    return null;
  }
};

export const setInStorage = async <T>(key: string, value: T): Promise<boolean> => {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error('Error setting storage:', error);
    return false;
  }
};

export const removeFromStorage = async (key: string): Promise<boolean> => {
  try {
    await chrome.storage.local.remove(key);
    return true;
  } catch (error) {
    console.error('Error removing from storage:', error);
    return false;
  }
};

export const clearStorage = async (): Promise<boolean> => {
  try {
    await chrome.storage.local.clear();
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};
