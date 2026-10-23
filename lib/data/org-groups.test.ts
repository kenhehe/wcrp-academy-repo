import { describe, expect, it } from 'vitest'
import { groupOrgsByType, orgFullLabel } from './org-groups'

describe('groupOrgsByType', () => {
  it('orders IPOs, Lighthouse Activities, Secretariat, each alphabetical, and drops empty groups', () => {
    const orgs = [
      { id: 'slc',  name: 'SLC',  type: 'lighthouse' },
      { id: 'wcrp', name: 'WCRP', type: 'secretariat' },
      { id: 'gewex', name: 'GEWEX', type: 'ipo' },
      { id: 'clic', name: 'CliC', type: 'ipo' },
      { id: 'de',   name: 'DE',   type: 'lighthouse' },
    ]
    expect(groupOrgsByType(orgs).map(g => [g.label, g.items.map(o => o.name)])).toEqual([
      ['IPOs', ['CliC', 'GEWEX']],
      ['Lighthouse Activities', ['DE', 'SLC']],
      ['Secretariat', ['WCRP']],
    ])
    expect(groupOrgsByType(orgs.filter(o => o.type === 'ipo')).map(g => g.type)).toEqual(['ipo'])
  })

  it('keeps an unknown type as its own group at the end instead of losing it', () => {
    const groups = groupOrgsByType([{ id: 'x', name: 'X', type: 'partner' }, { id: 'esmo', name: 'ESMO', type: 'ipo' }])
    expect(groups.map(g => [g.type, g.label])).toEqual([['ipo', 'IPOs'], ['partner', 'partner']])
  })
})

describe('orgFullLabel', () => {
  it('adds the full name only when it differs from the short one', () => {
    expect(orgFullLabel({ name: 'MCR', full_name: 'My Climate Risk' })).toBe('MCR · My Climate Risk')
    expect(orgFullLabel({ name: 'WCRP', full_name: 'WCRP' })).toBe('WCRP')
    expect(orgFullLabel({ name: 'GPEX', full_name: null })).toBe('GPEX')
  })
})
