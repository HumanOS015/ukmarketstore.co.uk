import moment from "moment";

// Maps the stored estimated_delivery window to the latest day count,
// used to compute a concrete "delivery by" date from today.
const DAY_RANGES = {
  "1-2 days": 2,
  "3-5 days": 5,
  "5-7 days": 7,
  "1-2 weeks": 14,
  "2+ weeks": 14,
};

export function getDeliveryDate(estimatedDelivery) {
  if (!estimatedDelivery) return null;
  const days = DAY_RANGES[estimatedDelivery];
  if (!days) return null;
  return moment().add(days, "days").toDate();
}

export function formatDeliveryDate(estimatedDelivery) {
  const d = getDeliveryDate(estimatedDelivery);
  if (!d) return null;
  return moment(d).format("ddd D MMM");
}