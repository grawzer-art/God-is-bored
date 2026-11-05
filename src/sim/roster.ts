/** Les huit habitants (données pures). */
import type { Need } from './defs';
export interface Look { skin: number; hair: string; hair_color: string; top: string; top_color: string; bottom: string; bottom_color: string; shoes: string; build: number; height: number; acc: string;
  /** Champs du créateur de personnage (tous facultatifs : les anciens personnages restent valides). */
  face?: number; eyes?: number; brows?: number; nose?: number; mouth?: number; ears?: number; freckles?: boolean; scars?: number[]; beard?: string; beard_color?: string; accs?: string[]; acc_color?: string; tattoos?: { part: string; motif: number }[] }
export interface RosterEntry {
  name: string; age: number; gender: 'F' | 'M'; job: string; bio: string; secret: string;
  traits: { extraversion: number; agreeableness: number; neuroticism: number; orderliness: number; openness: number };
  chrono: number; wake: number; bed: string; attracted_to: string[]; likes: string[]; dislikes: string[]; fav_food: string; goal: string;
  look: Look; faith: number; needs: Record<Need, number>;
}
export const ROSTER: RosterEntry[] = [
  { name: 'Camille Laurent', age: 29, gender: 'F', job: 'Illustratrice', bio: "Solaire et bavarde, elle dessine partout et adopte tout le monde.", secret: "Elle n'a pas vendu une seule illustration depuis un an.",
    traits: { extraversion: 0.85, agreeableness: 0.8, neuroticism: 0.4, orderliness: 0.3, openness: 0.9 }, chrono: 0.2, wake: 520, bed: 'bed_a_0', attracted_to: ['M', 'F'],
    likes: ['tv', 'chat', 'read'], dislikes: ['tidy', 'laundry'], fav_food: 'crêpes', goal: 'friend',
    look: { skin: 1, hair: 'long', hair_color: 'auburn', top: 'hoodie', top_color: 'yellow', bottom: 'jeans', bottom_color: 'denim', shoes: 'white', build: 0, height: 0, acc: 'none' },
    faith: 35, needs: { hunger: 38, energy: 82, bladder: 40, hygiene: 55, social: 40, fun: 45 } },
  { name: 'Mehdi Benali', age: 34, gender: 'M', job: 'Cuisinier', bio: 'Calme et généreux, il cuisine pour tout le monde et range en chantant.', secret: 'Il rêve de quitter la maison pour ouvrir son propre restaurant.',
    traits: { extraversion: 0.55, agreeableness: 0.85, neuroticism: 0.25, orderliness: 0.8, openness: 0.55 }, chrono: -0.4, wake: 450, bed: 'bed_b_0', attracted_to: ['F'],
    likes: ['cook', 'chat', 'water'], dislikes: ['tv'], fav_food: 'tajine', goal: 'cook',
    look: { skin: 2, hair: 'short', hair_color: 'black', top: 'tee', top_color: 'green', bottom: 'jeans', bottom_color: 'dark', shoes: 'brown', build: 1, height: 1, acc: 'beard' },
    faith: 45, needs: { hunger: 33, energy: 85, bladder: 38, hygiene: 60, social: 55, fun: 55 } },
  { name: 'Inès Moreau', age: 24, gender: 'F', job: 'Doctorante', bio: 'Anxieuse et brillante, elle vit la nuit entourée de livres et de tisane.', secret: 'Elle ne dort presque plus : elle entend des voix la nuit.',
    traits: { extraversion: 0.25, agreeableness: 0.6, neuroticism: 0.85, orderliness: 0.55, openness: 0.85 }, chrono: 0.9, wake: 590, bed: 'bed_c_0', attracted_to: ['F', 'M'],
    likes: ['read', 'browse', 'pray'], dislikes: ['tv', 'chat'], fav_food: 'soupe miso', goal: 'read',
    look: { skin: 0, hair: 'bob', hair_color: 'darkbrown', top: 'sweater', top_color: 'purple', bottom: 'jeans', bottom_color: 'dark', shoes: 'white', build: -1, height: -1, acc: 'glasses' },
    faith: 55, needs: { hunger: 45, energy: 70, bladder: 42, hygiene: 62, social: 62, fun: 50 } },
  { name: 'Théo Garnier', age: 41, gender: 'M', job: 'Plombier', bio: 'Bougon, matinal, allergique au bruit. Un cœur d\'or bien enfoui.', secret: 'Il paie en cachette les dettes de son frère.',
    traits: { extraversion: 0.3, agreeableness: 0.25, neuroticism: 0.55, orderliness: 0.75, openness: 0.25 }, chrono: -0.9, wake: 415, bed: 'bed_d_0', attracted_to: ['F'],
    likes: ['tidy', 'dishes', 'laundry'], dislikes: ['tv', 'chat'], fav_food: 'pot-au-feu', goal: 'tidy',
    look: { skin: 1, hair: 'short', hair_color: 'gray', top: 'flannel', top_color: 'red', bottom: 'jeans', bottom_color: 'dark', shoes: 'brown', build: 1, height: 1, acc: 'stubble' },
    faith: 20, needs: { hunger: 30, energy: 88, bladder: 28, hygiene: 66, social: 70, fun: 60 } },
  { name: 'Aïcha Diallo', age: 31, gender: 'F', job: 'Responsable marketing', bio: 'Magnétique et ambitieuse, elle sait toujours ce que veulent les autres.', secret: 'Elle manipule discrètement les alliances de la maison.',
    traits: { extraversion: 0.95, agreeableness: 0.45, neuroticism: 0.35, orderliness: 0.6, openness: 0.6 }, chrono: -0.2, wake: 465, bed: 'bed_a_1', attracted_to: ['M'],
    likes: ['chat', 'tv', 'bath'], dislikes: ['laundry', 'dishes'], fav_food: 'thieboudienne', goal: 'popular',
    look: { skin: 4, hair: 'braids', hair_color: 'black', top: 'tank', top_color: 'red', bottom: 'jeans', bottom_color: 'light', shoes: 'white', build: 0, height: 0, acc: 'earrings' },
    faith: 30, needs: { hunger: 40, energy: 86, bladder: 36, hygiene: 58, social: 35, fun: 40 } },
  { name: 'Lucas Petit', age: 22, gender: 'M', job: 'Étudiant', bio: 'Paresseux et drôle, il vit sur le canapé à un mètre de la manette.', secret: "Il a abandonné ses études il y a trois mois et n'ose pas le dire.",
    traits: { extraversion: 0.6, agreeableness: 0.55, neuroticism: 0.4, orderliness: 0.1, openness: 0.6 }, chrono: 1.0, wake: 630, bed: 'bed_d_1', attracted_to: ['F'],
    likes: ['tv', 'snack', 'nap'], dislikes: ['tidy', 'laundry', 'dishes'], fav_food: 'pizza', goal: 'fun',
    look: { skin: 0, hair: 'messy', hair_color: 'blond', top: 'hoodie', top_color: 'gray', bottom: 'shorts', bottom_color: 'dark', shoes: 'white', build: -1, height: 0, acc: 'none' },
    faith: 25, needs: { hunger: 42, energy: 60, bladder: 45, hygiene: 48, social: 50, fun: 35 } },
  { name: 'Margaux Roche', age: 52, gender: 'F', job: 'Infirmière retraitée', bio: 'Maternelle et organisée, elle veille sur tous… et sait tout.', secret: "Elle est malade et ne l'a dit à personne.",
    traits: { extraversion: 0.65, agreeableness: 0.9, neuroticism: 0.45, orderliness: 0.9, openness: 0.4 }, chrono: -0.7, wake: 430, bed: 'bed_c_1', attracted_to: ['M'],
    likes: ['water', 'tidy', 'cook', 'pray'], dislikes: ['tv'], fav_food: 'gratin', goal: 'tidy',
    look: { skin: 0, hair: 'bun', hair_color: 'silver', top: 'cardigan', top_color: 'teal', bottom: 'skirt', bottom_color: 'navy', shoes: 'brown', build: 1, height: -1, acc: 'none' },
    faith: 70, needs: { hunger: 36, energy: 84, bladder: 30, hygiene: 64, social: 48, fun: 52 } },
  { name: 'Karim Haddad', age: 38, gender: 'M', job: 'Développeur', bio: 'Discret, nerveux, le crâne rasé et le regard toujours ailleurs.', secret: "Il a un casier judiciaire que personne ne connaît.",
    traits: { extraversion: 0.3, agreeableness: 0.5, neuroticism: 0.75, orderliness: 0.45, openness: 0.7 }, chrono: 0.7, wake: 560, bed: 'bed_b_1', attracted_to: ['F', 'M'],
    likes: ['read', 'browse', 'snack'], dislikes: ['chat', 'pray'], fav_food: 'ramen', goal: 'respect',
    look: { skin: 3, hair: 'bald', hair_color: 'black', top: 'tee', top_color: 'black', bottom: 'jeans', bottom_color: 'dark', shoes: 'black', build: 0, height: 1, acc: 'stubble' },
    faith: 15, needs: { hunger: 48, energy: 66, bladder: 40, hygiene: 56, social: 66, fun: 50 } },
];
/** [a, b, affinité, familiarité, attirance] */
export const SEED_RELATIONS: [number, number, number, number, number][] = [
  [0, 1, 32, 55, 8], [1, 0, 28, 55, 5], [0, 4, 18, 50, 0], [4, 0, 8, 50, 0], [3, 5, -28, 45, 0], [5, 3, -22, 45, 0], [6, 2, 30, 60, 0], [2, 6, 22, 60, 0],
  [4, 7, 6, 40, 12], [7, 4, 2, 40, 0], [1, 6, 35, 55, 0], [6, 1, 38, 55, 0], [5, 0, 24, 45, 6], [0, 5, 20, 45, 4], [3, 6, 15, 50, 0], [6, 3, 12, 50, 0],
  [7, 2, 10, 40, 4], [2, 7, 8, 40, 0],
];
export const GOALS: Record<string, { text: string; target: number }> = {
  friend: { text: 'Se faire un(e) ami(e) proche', target: 1 },
  cook: { text: 'Cuisiner pour les autres (5 repas partagés)', target: 5 },
  read: { text: 'Lire 5 fois', target: 5 },
  tidy: { text: 'Garder la maison propre (8 rangements)', target: 8 },
  popular: { text: 'Avoir 4 amis dans la maison', target: 4 },
  fun: { text: 'Regarder 4 fois la télé', target: 4 },
  respect: { text: 'Avoir 3 conversations réussies', target: 3 },
  clean: { text: 'Prendre 3 douches', target: 3 },
  faith: { text: 'Prier 3 fois', target: 3 },
  social: { text: 'Avoir 6 conversations réussies', target: 6 },
};
export const GOAL_CYCLE = ['social', 'clean', 'faith', 'read', 'tidy', 'friend'];
