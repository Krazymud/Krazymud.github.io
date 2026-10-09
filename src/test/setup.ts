import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetPrefsCache } from '../prefs/prefs'

afterEach(() => {
  cleanup()
  resetPrefsCache()
})
