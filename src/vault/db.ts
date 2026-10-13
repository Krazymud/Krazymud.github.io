export const GARAGE_DB = 'midnight-garage'
export const GARAGE_DB_VERSION = 2

export function upgradeGarageDb(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault')
  if (!db.objectStoreNames.contains('vault-web')) db.createObjectStore('vault-web')
}
