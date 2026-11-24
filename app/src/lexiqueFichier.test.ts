import { describe, expect, it } from 'vitest'
import { lexiqueDepuisJson, lexiqueVersJson } from './lexiqueFichier'

describe('sauvegarde du Lexique', () => {
  it('round-trips the words', () => {
    expect(lexiqueDepuisJson(lexiqueVersJson('La Révolution humaine', ['nichiren', 'gakkaï']))).toEqual([
      'gakkaï',
      'nichiren',
    ])
  })

  it('rejects a file that is not a Lexique backup', () => {
    expect(() => lexiqueDepuisJson('{"mots": ["a"]}')).toThrow()
    expect(() => lexiqueDepuisJson('pas du json')).toThrow()
  })
})
