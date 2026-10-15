export const COS_VAULT_CONFIG = {
  bucket: import.meta.env.VITE_COS_BUCKET as string,
  region: import.meta.env.VITE_COS_REGION as string,
  vaultPrefix: 'vault',
} as const

export const STS_ISSUER_URL = import.meta.env.VITE_STS_ISSUER_URL as string
