/** Les 10 habitants fondateurs de NORIA (données pures, extensibles). Seuls certains sont actifs dans la simulation : les autres sont préparés pour les prochains quartiers.
 *  `active` = le personnage existe déjà dans le monde (roster ou citoyen) ; sinon il est « en réserve » et ne sera créé qu'avec son quartier. */
export type District = 'Noria Beach' | 'Downtown Noria' | 'Mirage Strip' | 'Golden Hills' | 'South Noria' | 'Blackwater Docks' | 'Eden Campus';
export const DISTRICTS: { name: District; theme: string; built: boolean }[] = [
  { name: 'Noria Beach', theme: 'plage, promenade, studios, petits commerces', built: true },
  { name: 'Downtown Noria', theme: 'centre-ville, bureaux, commissariat, café', built: true },
  { name: 'Mirage Strip', theme: 'vie nocturne, bars, casinos', built: false },
  { name: 'Golden Hills', theme: 'villas, argent, secrets', built: false },
  { name: 'South Noria', theme: 'quartier populaire, garages, musique', built: false },
  { name: 'Blackwater Docks', theme: 'port, entrepôts, trafics', built: false },
  { name: 'Eden Campus', theme: 'université, recherche, jeunesse', built: false },
];
export interface Founder {
  name: string; age: number; district: District; job: string; personality: string; ambition: string; secret: string;
  routine: string[]; active: boolean;
}
export const FOUNDERS: Founder[] = [
  { name: 'Tommy Blake', age: 26, district: 'Noria Beach', job: 'Livreur', personality: 'drôle, impulsif, loyal', ambition: 'ouvrir son propre garage', secret: "livre des colis suspects et doit de l'argent à Victor Kane", routine: ['matin : tournée de livraison', 'soir : plage', 'nuit : rentre aux Mouettes'], active: true },
  { name: 'Maya Torres', age: 24, district: 'Noria Beach', job: 'Serveuse au café', personality: 'chaleureuse, observatrice, ambitieuse', ambition: 'ouvrir son propre café-concert', secret: 'a quitté sa famille sans prévenir', routine: ['matin : service du café', 'après-midi : promenade', 'soir : concerts'], active: false },
  { name: 'Marcus "Flex" Rivera', age: 29, district: 'South Noria', job: 'Garagiste et coach', personality: 'charismatique, protecteur, fier', ambition: 'devenir une légende locale du combat', secret: 'a perdu un combat truqué', routine: ['journée : garage', 'soir : salle de sport'], active: false },
  { name: 'Capitaine Elena Reyes', age: 41, district: 'Downtown Noria', job: 'Capitaine de police', personality: 'rigoureuse, juste, fatiguée', ambition: 'nettoyer la ville sans compromis', secret: 'a classé un dossier pour protéger un proche', routine: ['jour : commissariat', 'nuit : patrouilles'], active: true },
  { name: 'Dr Lena Carter', age: 37, district: 'Eden Campus', job: 'Médecin-chercheuse', personality: 'brillante, discrète, obstinée', ambition: 'comprendre une anomalie médicale à NORIA', secret: 'a falsifié une donnée de recherche', routine: ['jour : laboratoire', 'soir : garde à la clinique'], active: false },
  { name: 'Roxanne Bell', age: 33, district: 'Mirage Strip', job: 'Gérante de club', personality: 'magnétique, calculatrice, drôle', ambition: 'posséder tout le Strip', secret: 'protège un informateur de la police', routine: ['après-midi : comptes', 'nuit : club'], active: false },
  { name: 'Victor Kane', age: 48, district: 'Blackwater Docks', job: 'Courtier du port', personality: 'poli, patient, dangereux', ambition: 'contrôler chaque cargaison de NORIA', secret: "possède des dettes et des témoins qu'il fait taire", routine: ['jour : entrepôts', 'soir : restaurant des Docks'], active: false },
  { name: 'Elliot Park', age: 22, district: 'Eden Campus', job: 'Étudiant en informatique', personality: 'timide, curieux, insomniaque', ambition: 'percer le secret du réseau de NORIA', secret: 'a trouvé une faille qui ne devrait pas exister', routine: ['jour : cours', 'nuit : code'], active: false },
  { name: 'Jayden "Ghost" Walker', age: 30, district: 'South Noria', job: 'Coursier de nuit', personality: 'silencieux, méfiant, rapide', ambition: 'disparaître avec assez d\'argent', secret: 'travaille pour deux camps à la fois', routine: ['nuit : courses', 'jour : dort'], active: false },
  { name: 'Père Elijah', age: 63, district: 'Golden Hills', job: 'Prêtre', personality: 'serein, perspicace, secret', ambition: 'rendre à la ville sa conscience', secret: 'sait que le monde de NORIA a une origine qu\'il ne peut pas prouver', routine: ['matin : messe', 'après-midi : visites', 'soir : confessions'], active: false },
];
export const founderByName = (name: string) => FOUNDERS.find((f) => f.name === name);
