export const dummyBids = [
  {
    id: 1,
    crop: "Wheat",
    bid_price: 1800,
    reference_price: 2000,
    assessment: "BELOW_FAIR",
    gap_pct: -10,
    stale: false,
    source_unavailable: false
  },
  {
    id: 2,
    crop: "Rice",
    bid_price: 2050,
    reference_price: 2000,
    assessment: "FAIR",
    gap_pct: 2.5,
    stale: false,
    source_unavailable: false
  },
  {
    id: 3,
    crop: "Corn",
    bid_price: 2500,
    reference_price: 2500,
    assessment: "FAIR",
    gap_pct: 0,
    stale: true,
    source_unavailable: false
  },
  {
    id: 4,
    crop: "Soybean",
    bid_price: 3000,
    reference_price: null,
    assessment: "NO_REFERENCE",
    gap_pct: null,
    stale: false,
    source_unavailable: false
  },
  {
    id: 5,
    crop: "Barley",
    bid_price: 1500,
    reference_price: null,
    assessment: null,
    gap_pct: null,
    stale: false,
    source_unavailable: true 
  }
];