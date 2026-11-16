/* Demo data modelled on the original LOANDOM sheet.
 *
 * Week tokens "@current" / "@prev" are resolved to real reset weeks at load
 * time, so the demo always looks alive. Character names and item levels follow
 * the guild roster snapshot; edit them in Roster, or wipe the demo from
 * Settings and start from your own sheet.
 *
 * Layout decoded from the sheet:
 *   columns  = roster owners (OIS, RYN, DP, TQ)
 *   rows     = one run per row, one character per owner in that run
 *   checkbox = run cleared -> that run's gold is earned
 */

export const seed = {
  version: 1,
  name: 'LOANDOM',

  players: [
    { id: 'p_ois', name: 'OIS', tag: 'OIS', color: '#94a3b8', order: 10 },
    { id: 'p_ryn', name: 'RYN', tag: 'RYN', color: '#a855f7', order: 20 },
    { id: 'p_dp', name: 'DP', tag: 'DP', color: '#64748b', order: 30 },
    { id: 'p_tq', name: 'TQ', tag: 'TQ', color: '#f59e0b', order: 40 },
  ],

  raids: [
    {
      id: 'raid_belgardin_nm',
      name: 'Belgardin',
      short: 'BELGARDIN NM',
      difficulty: 'Normal',
      ilvl: 1750,
      goldTradable: 50000,
      goldBound: 0,
      partySize: 8,
      order: 10,
      active: true,
      note: 'Shadow Raid · 2 gates · 8 players',
    },
    {
      id: 'raid_kazeros_hm',
      name: 'Kazeros: Final Day',
      short: 'KAZEROS HM',
      difficulty: 'Hard',
      ilvl: 1730,
      goldTradable: 48000,
      goldBound: 0,
      partySize: 8,
      order: 20,
      active: true,
      note: 'Denouement · 2 gates · 8 players',
    },
    {
      id: 'raid_belgardin_hm',
      name: 'Belgardin',
      short: 'BELGARDIN HM',
      difficulty: 'Hard',
      ilvl: 1770,
      goldTradable: 62000,
      goldBound: 0,
      partySize: 8,
      order: 30,
      active: true,
      note: 'Shadow Raid · 2 gates · 8 players',
    },
    {
      id: 'raid_serca_hm',
      name: 'Serca',
      short: 'SERCA HM',
      difficulty: 'Hard',
      ilvl: 1730,
      goldTradable: 44000,
      goldBound: 0,
      partySize: 8,
      order: 40,
      active: true,
      note: 'Shadow Raid · 8 players',
    },
  ],

  characters: [
    // OIS
    { id: 'c_ois_cafra', playerId: 'p_ois', name: 'Cafra', className: '', ilvl: 1751.67, goldEarner: true, active: true },
    { id: 'c_ois_secil', playerId: 'p_ois', name: 'Shechil', className: '', ilvl: 1755.83, goldEarner: true, active: true },
    { id: 'c_ois_secil2', playerId: 'p_ois', name: 'Shechiil', className: '', ilvl: 1733.33, goldEarner: true, active: true },
    { id: 'c_ois_hyun', playerId: 'p_ois', name: 'Hyünwoo', className: '', ilvl: 1750.83, goldEarner: true, active: true },
    { id: 'c_ois_pelts', playerId: 'p_ois', name: 'Feltz', className: '', ilvl: 1750.83, goldEarner: true, active: true },
    { id: 'c_ois_eur', playerId: 'p_ois', name: 'Euir', className: '', ilvl: 1770.83, goldEarner: true, active: true },

    // RYN
    { id: 'c_ryn_pap', playerId: 'p_ryn', name: 'Vaif', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_ryn_nur', playerId: 'p_ryn', name: 'Elnour', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_ryn_tayori', playerId: 'p_ryn', name: 'Tayori', className: '', ilvl: 1770.83, goldEarner: true, active: true },
    { id: 'c_ryn_tayorii', playerId: 'p_ryn', name: 'Tayorii', className: '', ilvl: 1751.67, goldEarner: true, active: true },
    { id: 'c_ryn_frian', playerId: 'p_ryn', name: 'Friann', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_ryn_maung', playerId: 'p_ryn', name: 'Suramaung', className: '', ilvl: 1732.5, goldEarner: true, active: true },

    // DP
    { id: 'c_dp_suki', playerId: 'p_dp', name: 'Witsuki', className: '', ilvl: 1751.67, goldEarner: true, active: true },
    { id: 'c_dp_sua', playerId: 'p_dp', name: 'Witsua', className: '', ilvl: 1750.83, goldEarner: true, active: true },
    { id: 'c_dp_boncel', playerId: 'p_dp', name: 'Bouncel', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_dp_susu', playerId: 'p_dp', name: 'Witsusu', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_dp_nol2', playerId: 'p_dp', name: 'Noldua', className: '', ilvl: 1750, goldEarner: true, active: true },
    { id: 'c_dp_wisun', playerId: 'p_dp', name: 'Witsune', className: '', ilvl: 1771.67, goldEarner: true, active: true },

    // TQ — empty roster in the sheet
  ],

  runs: [
    // Belgardin NM — 4 runs, all cleared (4 x 50,000 = 200,000)
    { id: 'r_bnm_1', week: '@current', raidId: 'raid_belgardin_nm', index: 1, cleared: true, claims: 1 },
    { id: 'r_bnm_2', week: '@current', raidId: 'raid_belgardin_nm', index: 2, cleared: true, claims: 1 },
    { id: 'r_bnm_3', week: '@current', raidId: 'raid_belgardin_nm', index: 3, cleared: true, claims: 1 },
    { id: 'r_bnm_4', week: '@current', raidId: 'raid_belgardin_nm', index: 4, cleared: true, claims: 1 },

    // Kazeros HM — 6 slots, nothing cleared yet (0 gold)
    { id: 'r_kaz_1', week: '@current', raidId: 'raid_kazeros_hm', index: 1, cleared: false, claims: 1 },
    { id: 'r_kaz_2', week: '@current', raidId: 'raid_kazeros_hm', index: 2, cleared: false, claims: 1 },
    { id: 'r_kaz_3', week: '@current', raidId: 'raid_kazeros_hm', index: 3, cleared: false, claims: 1 },
    { id: 'r_kaz_4', week: '@current', raidId: 'raid_kazeros_hm', index: 4, cleared: false, claims: 1 },
    { id: 'r_kaz_5', week: '@current', raidId: 'raid_kazeros_hm', index: 5, cleared: false, claims: 1 },
    { id: 'r_kaz_6', week: '@current', raidId: 'raid_kazeros_hm', index: 6, cleared: false, claims: 1 },

    // Belgardin HM — 6 slots, 1 cleared (62,000)
    { id: 'r_bhm_1', week: '@current', raidId: 'raid_belgardin_hm', index: 1, cleared: true, claims: 1 },
    { id: 'r_bhm_2', week: '@current', raidId: 'raid_belgardin_hm', index: 2, cleared: false, claims: 1 },
    { id: 'r_bhm_3', week: '@current', raidId: 'raid_belgardin_hm', index: 3, cleared: false, claims: 1 },
    { id: 'r_bhm_4', week: '@current', raidId: 'raid_belgardin_hm', index: 4, cleared: false, claims: 1 },
    { id: 'r_bhm_5', week: '@current', raidId: 'raid_belgardin_hm', index: 5, cleared: false, claims: 1 },
    { id: 'r_bhm_6', week: '@current', raidId: 'raid_belgardin_hm', index: 6, cleared: false, claims: 1 },

    // Serca HM — 6 runs, all cleared (6 x 44,000 = 264,000)
    { id: 'r_shm_1', week: '@current', raidId: 'raid_serca_hm', index: 1, cleared: true, claims: 1 },
    { id: 'r_shm_2', week: '@current', raidId: 'raid_serca_hm', index: 2, cleared: true, claims: 1 },
    { id: 'r_shm_3', week: '@current', raidId: 'raid_serca_hm', index: 3, cleared: true, claims: 1 },
    { id: 'r_shm_4', week: '@current', raidId: 'raid_serca_hm', index: 4, cleared: true, claims: 1 },
    { id: 'r_shm_5', week: '@current', raidId: 'raid_serca_hm', index: 5, cleared: true, claims: 1 },
    { id: 'r_shm_6', week: '@current', raidId: 'raid_serca_hm', index: 6, cleared: true, claims: 1 },
  ],

  assignments: [
    // Belgardin NM
    { id: 'a_bnm1_ois', runId: 'r_bnm_1', playerId: 'p_ois', characterId: 'c_ois_cafra', name: 'Cafra' },
    { id: 'a_bnm1_ryn', runId: 'r_bnm_1', playerId: 'p_ryn', characterId: 'c_ryn_pap', name: 'Vaif' },
    { id: 'a_bnm1_dp', runId: 'r_bnm_1', playerId: 'p_dp', characterId: 'c_dp_suki', name: 'Witsuki' },
    { id: 'a_bnm2_ois', runId: 'r_bnm_2', playerId: 'p_ois', characterId: 'c_ois_secil', name: 'Shechil' },
    { id: 'a_bnm2_ryn', runId: 'r_bnm_2', playerId: 'p_ryn', characterId: 'c_ryn_nur', name: 'Elnour' },
    { id: 'a_bnm2_dp', runId: 'r_bnm_2', playerId: 'p_dp', characterId: 'c_dp_sua', name: 'Witsua' },
    { id: 'a_bnm3_ois', runId: 'r_bnm_3', playerId: 'p_ois', characterId: 'c_ois_hyun', name: 'Hyünwoo' },
    { id: 'a_bnm3_ryn', runId: 'r_bnm_3', playerId: 'p_ryn', characterId: 'c_ryn_tayori', name: 'Tayori' },
    { id: 'a_bnm3_dp', runId: 'r_bnm_3', playerId: 'p_dp', characterId: 'c_dp_boncel', name: 'Bouncel' },
    { id: 'a_bnm4_ois', runId: 'r_bnm_4', playerId: 'p_ois', characterId: 'c_ois_pelts', name: 'Feltz' },
    { id: 'a_bnm4_ryn', runId: 'r_bnm_4', playerId: 'p_ryn', characterId: 'c_ryn_frian', name: 'Friann' },
    { id: 'a_bnm4_dp', runId: 'r_bnm_4', playerId: 'p_dp', characterId: 'c_dp_susu', name: 'Witsusu' },

    // Kazeros HM
    { id: 'a_kaz1_ois', runId: 'r_kaz_1', playerId: 'p_ois', characterId: 'c_ois_cafra', name: 'Cafra' },
    { id: 'a_kaz1_ryn', runId: 'r_kaz_1', playerId: 'p_ryn', characterId: 'c_ryn_maung', name: 'Suramaung' },
    { id: 'a_kaz1_dp', runId: 'r_kaz_1', playerId: 'p_dp', characterId: 'c_dp_suki', name: 'Witsuki' },
    { id: 'a_kaz2_ois', runId: 'r_kaz_2', playerId: 'p_ois', characterId: 'c_ois_secil', name: 'Shechil' },
    { id: 'a_kaz2_ryn', runId: 'r_kaz_2', playerId: 'p_ryn', characterId: 'c_ryn_nur', name: 'Elnour' },
    { id: 'a_kaz2_dp', runId: 'r_kaz_2', playerId: 'p_dp', characterId: 'c_dp_susu', name: 'Witsusu' },
    { id: 'a_kaz3_ois', runId: 'r_kaz_3', playerId: 'p_ois', characterId: 'c_ois_secil2', name: 'Shechiil' },
    { id: 'a_kaz3_ryn', runId: 'r_kaz_3', playerId: 'p_ryn', characterId: 'c_ryn_tayori', name: 'Tayori' },
    { id: 'a_kaz3_dp', runId: 'r_kaz_3', playerId: 'p_dp', characterId: 'c_dp_boncel', name: 'Bouncel' },
    { id: 'a_kaz4_ois', runId: 'r_kaz_4', playerId: 'p_ois', characterId: 'c_ois_hyun', name: 'Hyünwoo' },
    { id: 'a_kaz4_ryn', runId: 'r_kaz_4', playerId: 'p_ryn', characterId: 'c_ryn_pap', name: 'Vaif' },
    { id: 'a_kaz4_dp', runId: 'r_kaz_4', playerId: 'p_dp', characterId: 'c_dp_nol2', name: 'Noldua' },
    { id: 'a_kaz5_ois', runId: 'r_kaz_5', playerId: 'p_ois', characterId: 'c_ois_pelts', name: 'Feltz' },
    { id: 'a_kaz5_ryn', runId: 'r_kaz_5', playerId: 'p_ryn', characterId: 'c_ryn_frian', name: 'Friann' },
    { id: 'a_kaz5_dp', runId: 'r_kaz_5', playerId: 'p_dp', characterId: 'c_dp_sua', name: 'Witsua' },

    // Belgardin HM
    { id: 'a_bhm1_ois', runId: 'r_bhm_1', playerId: 'p_ois', characterId: 'c_ois_eur', name: 'Euir' },
    { id: 'a_bhm1_ryn', runId: 'r_bhm_1', playerId: 'p_ryn', characterId: 'c_ryn_tayori', name: 'Tayori' },
    { id: 'a_bhm1_dp', runId: 'r_bhm_1', playerId: 'p_dp', characterId: 'c_dp_wisun', name: 'Witsune' },

    // Serca HM (row 1 is Tayori, row 4 is Tayorii — two different characters)
    { id: 'a_shm1_ois', runId: 'r_shm_1', playerId: 'p_ois', characterId: 'c_ois_eur', name: 'Euir' },
    { id: 'a_shm1_ryn', runId: 'r_shm_1', playerId: 'p_ryn', characterId: 'c_ryn_tayori', name: 'Tayori' },
    { id: 'a_shm1_dp', runId: 'r_shm_1', playerId: 'p_dp', characterId: 'c_dp_sua', name: 'Witsua' },
    { id: 'a_shm2_ois', runId: 'r_shm_2', playerId: 'p_ois', characterId: 'c_ois_cafra', name: 'Cafra' },
    { id: 'a_shm2_ryn', runId: 'r_shm_2', playerId: 'p_ryn', characterId: 'c_ryn_frian', name: 'Friann' },
    { id: 'a_shm2_dp', runId: 'r_shm_2', playerId: 'p_dp', characterId: 'c_dp_nol2', name: 'Noldua' },
    { id: 'a_shm3_ois', runId: 'r_shm_3', playerId: 'p_ois', characterId: 'c_ois_secil', name: 'Shechil' },
    { id: 'a_shm3_ryn', runId: 'r_shm_3', playerId: 'p_ryn', characterId: 'c_ryn_nur', name: 'Elnour' },
    { id: 'a_shm3_dp', runId: 'r_shm_3', playerId: 'p_dp', characterId: 'c_dp_susu', name: 'Witsusu' },
    { id: 'a_shm4_ois', runId: 'r_shm_4', playerId: 'p_ois', characterId: 'c_ois_secil2', name: 'Shechiil' },
    { id: 'a_shm4_ryn', runId: 'r_shm_4', playerId: 'p_ryn', characterId: 'c_ryn_tayorii', name: 'Tayorii' },
    { id: 'a_shm4_dp', runId: 'r_shm_4', playerId: 'p_dp', characterId: 'c_dp_boncel', name: 'Bouncel' },
    { id: 'a_shm5_ois', runId: 'r_shm_5', playerId: 'p_ois', characterId: 'c_ois_hyun', name: 'Hyünwoo' },
    { id: 'a_shm5_ryn', runId: 'r_shm_5', playerId: 'p_ryn', characterId: 'c_ryn_pap', name: 'Vaif' },
    { id: 'a_shm5_dp', runId: 'r_shm_5', playerId: 'p_dp', characterId: 'c_dp_suki', name: 'Witsuki' },
    { id: 'a_shm6_ois', runId: 'r_shm_6', playerId: 'p_ois', characterId: 'c_ois_pelts', name: 'Feltz' },
    { id: 'a_shm6_ryn', runId: 'r_shm_6', playerId: 'p_ryn', characterId: 'c_ryn_maung', name: 'Suramaung' },
    { id: 'a_shm6_dp', runId: 'r_shm_6', playerId: 'p_dp', characterId: 'c_dp_wisun', name: 'Witsune' },
  ],

  ledger: [
    {
      id: 'l_bound_import',
      week: '@current',
      kind: 'bound',
      amount: 231000,
      source: 'Sheet',
      note: 'BOUND GOLD total from the original sheet (other content, not the raid blocks)',
      playerId: '',
      characterId: '',
    },
  ],
};
