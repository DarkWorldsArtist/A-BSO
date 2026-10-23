
import { Bank } from '@/structures/Bank.js';
import type { MonsterKillOptions } from '@/structures/Monster.js';
import { Monster } from '@/structures/Monster.js';

class MaggotKingSingleton extends Monster {
    public kill(quantity = 1, options: MonsterKillOptions = {}): Bank {
        const loot = new Bank();

        // TODO: Implement normal loot and egg-taking mechanics.
        // TODO: Add verified drop rates.

        return loot;
    }
}

export const MaggotKing: MaggotKingSingleton = new MaggotKingSingleton({
    id: 15742,
    name: 'Maggot King',
    aliases: ['maggot king', 'maggotking']
});
