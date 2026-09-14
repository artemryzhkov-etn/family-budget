import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBasketShopping,
  faBolt,
  faBus,
  faCar,
  faChartPie,
  faDog,
  faEnvelopeOpenText,
  faFilm,
  faGamepad,
  faGift,
  faGraduationCap,
  faHeartPulse,
  faHouse,
  faMugHot,
  faPiggyBank,
  faPlane,
  faShirt,
  faUtensils,
  faWallet,
  faWifi,
} from '@fortawesome/free-solid-svg-icons';

/** Icons a user can pick for an envelope. Keys are stored in data. */
export const ENVELOPE_ICONS: Record<string, IconDefinition> = {
  basket: faBasketShopping,
  utensils: faUtensils,
  house: faHouse,
  bolt: faBolt,
  wifi: faWifi,
  car: faCar,
  bus: faBus,
  heart: faHeartPulse,
  shirt: faShirt,
  film: faFilm,
  gamepad: faGamepad,
  mug: faMugHot,
  gift: faGift,
  plane: faPlane,
  dog: faDog,
  education: faGraduationCap,
  piggy: faPiggyBank,
  wallet: faWallet,
  chart: faChartPie,
  envelope: faEnvelopeOpenText,
};

export function envelopeIcon(key: string): IconDefinition {
  return ENVELOPE_ICONS[key] ?? faEnvelopeOpenText;
}
