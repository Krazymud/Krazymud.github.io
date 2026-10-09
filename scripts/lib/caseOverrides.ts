export interface CaseOverride {
  w: string
  pos?: string
  m?: string
}

// CET rows that ECDICT files under a capitalized spelling but that are ordinary words.
// Every other non-lowercase row (names, places, nationalities, abbreviations) is dropped.
export const CASE_OVERRIDES: Readonly<Record<string, CaseOverride>> = {
  Conservative: { w: 'conservative' },
  CORE: { w: 'core' },
  FAX: { w: 'fax' },
  God: { w: 'god', pos: 'n.', m: 'n. 神，神像，偶像' },
  Mister: { w: 'mister' },
  Pole: { w: 'pole', pos: 'n.', m: 'n. 杆，柱；极，电极' },
  Polish: { w: 'polish', pos: 'v.', m: 'v. 擦亮，使完美；n. 上光剂，光泽' },
  Saint: { w: 'saint' },
}

// Explicit phonetics for ECDICT rows whose phonetic field is garbage or ambiguous.
export const PHONETIC_FIXES: Readonly<Record<string, string>> = {
  permanently: "'pə:mənəntli",
  conversely: "'kɔnvə:sli",
  universally: ",ju:ni'və:səli",
  simultaneously: ",siməl'teiniəsli",
}
