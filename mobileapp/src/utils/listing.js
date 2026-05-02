import { formatCurrency } from './format';

export const LISTING_TYPE_LABELS = {
  'buy-now': 'Buy Now',
  offer: 'Offer',
  auction: 'Auction',
  rental: 'Rental',
};

export const CATEGORY_LABELS = {
  physical: 'Physical',
  digital: 'Digital',
  ticket: 'Ticket',
  merch: 'Merch',
};

export const toNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value && typeof value === 'object') {
    if (value.$numberDecimal != null) return toNumber(value.$numberDecimal, fallback);
    if (value.amount != null) return toNumber(value.amount, fallback);
  }
  return fallback;
};

export const isAuctionListing = (listing) => listing?.listingType === 'auction';

export const getListingDisplayPrice = (listing, override) => {
  if (!listing) return 0;
  if (override != null) return toNumber(override);

  if (listing.listingType === 'rental') {
    const rate = toNumber(listing.rental?.ratePerDay, NaN);
    return Number.isFinite(rate) && rate > 0 ? rate : toNumber(listing.price);
  }

  if (isAuctionListing(listing)) {
    const currentBid = toNumber(listing.auction?.currentBid?.amount, 0);
    if (currentBid > 0) return currentBid;

    const startBid = toNumber(listing.auction?.startBid, NaN);
    if (Number.isFinite(startBid)) return startBid;
  }

  return toNumber(
    listing.price ??
      listing.amount ??
      listing.listingPrice ??
      listing.currentPrice ??
      listing.rental?.ratePerDay
  );
};

export const getListingPriceText = (listing, override) => {
  const price = getListingDisplayPrice(listing, override);
  return listing?.listingType === 'rental'
    ? `${formatCurrency(price)}/day`
    : formatCurrency(price);
};

export const getListingTypeLabel = (type) => LISTING_TYPE_LABELS[type] || 'Listing';

export const getCategoryLabel = (category) => CATEGORY_LABELS[category] || category || 'Listing';
