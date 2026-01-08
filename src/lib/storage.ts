export type AIPreference = "safe" | "fast" | null

export interface UserConfig {
  aiPreference: AIPreference
  onboardingCompleted: boolean
}

export const StorageKeys = {
  USER_CONFIG: "user_config"
}

export const getUserConfig = async (): Promise<UserConfig> => {
  const result = await chrome.storage.local.get(StorageKeys.USER_CONFIG)
  return result[StorageKeys.USER_CONFIG] || { aiPreference: null, onboardingCompleted: false }
}

export const saveUserConfig = async (config: Partial<UserConfig>) => {
  const current = await getUserConfig()
  const updated = { ...current, ...config }
  await chrome.storage.local.set({ [StorageKeys.USER_CONFIG]: updated })
  return updated
}
