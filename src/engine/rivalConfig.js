export const RIVAL_CONFIG = Object.freeze({
  defaultRivalId: 'olJoe',
  rivals: Object.freeze({
    olJoe: freezeRival({
      id: 'olJoe',
      name: 'Ol Joe',
      buttonDoodle: 'oljoe_button',
      crossedDoodle: 'crossed1',
      matchups: {
        '0-0': { reload: 100 },
        '1-1': { shoot: 45, block: 35, stab: 20, reload: 0, counterstab: 0 },
        '1-0': { shoot: 38, stab: 38, reload: 24 },
        '2-0': { reload: 40, shoot: 30, stab: 30 },
        '0-1': { block: 45, counterstab: 45, reload: 10 },
        '2-1': { shoot: 42, block: 24, stab: 18, reload: 16 },
        '1-2': { block: 32, counterstab: 28, shoot: 25, stab: 10, reload: 5 },
      },
    }),
    mackTheKnife: freezeRival({
      id: 'mackTheKnife',
      name: 'Mack the Knife',
      buttonDoodle: 'mactheknife_button',
      crossedDoodle: 'crossed2',
      matchups: {
        '0-0': { reload: 100 },
        '1-1': { stab: 40, shoot: 30, block: 30, reload: 0 },
        '1-0': { stab: 60, shoot: 20, reload: 35 },
        '2-0': { stab: 65, reload: 5, shoot: 30 },
        '0-1': { counterstab: 45, block: 55, reload: 0 },
        '2-1': { stab: 50, shoot: 22, counterstab: 14, block: 9, reload: 5 },
        '1-2': { counterstab: 36, stab: 28, block: 22, shoot: 9, reload: 5 },
      },
    }),
    blastinDan: freezeRival({
      id: 'blastinDan',
      name: 'Blastin Dan',
      buttonDoodle: 'blastindan_button',
      crossedDoodle: 'crossed3',
      matchups: {
        '0-0': { reload: 100 },
        '1-1': { shoot: 40, stab: 30, block: 25, reload: 5 },
        '1-0': { shoot: 70, reload: 20, stab: 10 },
        '2-0': { shoot: 75, reload: 15, stab: 10 },
        '0-1': { block: 45, counterstab: 45, reload: 10 },
        '2-1': { shoot: 55, block: 25, stab: 12, reload: 8 },
        '1-2': { shoot: 50, stab: 25, block: 20, counterstab: 5, reload: 0 },
      },
    }),
    katheyClever: freezeRival({
      id: 'katheyClever',
      name: 'Kathey Clever',
      buttonDoodle: 'katheyclever_button',
      crossedDoodle: 'crossed4',
      matchups: {
        '0-0': { reload: 100 },
        '1-1': { shoot: 34, block: 33, stab: 33 },
        '1-0': { reload: 60, shoot: 20, stab: 20 },
        '2-0': { reload: 0, shoot: 50, stab: 50 },
        '0-1': { block: 45, counterstab: 45, reload: 10 },
        '2-1': { reload: 0, counterstab: 0, block: 30, shoot: 40, stab: 30 },
        '1-2': { shoot: 34, block: 33, stab: 33 },
      },
    }),
  }),
});

function freezeRival(rival) {
  return Object.freeze({
    ...rival,
    matchups: Object.freeze(Object.fromEntries(
      Object.entries(rival.matchups).map(([key, weights]) => [key, Object.freeze(weights)]),
    )),
  });
}
