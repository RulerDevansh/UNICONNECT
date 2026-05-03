import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clock3, Eye, Gavel, HandCoins, ImageIcon, MapPin, Package, ShoppingBag, Tag } from 'lucide-react-native';
import api from '../services/api';
import { colors, commonStyles, radius, spacing } from '../theme';
import { timeRemaining } from '../utils/format';
import { getCategoryLabel, getListingDisplayPrice, getListingPriceText, getListingTypeLabel, isAuctionListing } from '../utils/listing';
import { getId, sameId } from '../utils/id';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { AppButton, Badge } from './ui';

const typeTone = {
  'buy-now': 'success',
  offer: 'warning',
  auction: 'info',
  rental: 'orange',
};

const typeIcon = {
  'buy-now': ShoppingBag,
  offer: HandCoins,
  auction: Gavel,
  rental: Package,
};

const ListingCard = ({ listing, onView, compact = false, onChanged }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const isAuction = isAuctionListing(listing);
  const isRental = listing.listingType === 'rental';
  const sellerId = getId(listing.seller);
  const currentUserId = getId(user);
  const status = listing.status || 'active';
  const isOwnListing = sameId(sellerId, currentUserId);
  const canBuy = listing.listingType === 'buy-now' && sellerId && !isOwnListing && status === 'active';
  const [displayPrice, setDisplayPrice] = useState(() => getListingDisplayPrice(listing));
  const TypeIcon = typeIcon[listing.listingType] || Tag;

  useEffect(() => {
    setDisplayPrice(getListingDisplayPrice(listing));
  }, [
    listing._id,
    listing.price,
    listing.listingType,
    listing.auction?.currentBid?.amount,
    listing.auction?.startBid,
    listing.rental?.ratePerDay,
  ]);

  useEffect(() => {
    if (!socket || !isAuction) return undefined;
    const listingId = listing._id;
    socket.emit('auction:join', { listingId });
    const onUpdate = (payload) => {
      if (payload.listingId !== listingId) return;
      if (payload.currentBid?.amount != null && payload.currentBid.amount > 0) {
        setDisplayPrice(payload.currentBid.amount);
      } else {
        setDisplayPrice(getListingDisplayPrice(listing));
      }
    };
    socket.on('auction:update', onUpdate);
    return () => socket.off('auction:update', onUpdate);
  }, [socket, isAuction, listing]);

  const priceText = useMemo(
    () => getListingPriceText(listing, displayPrice),
    [displayPrice, listing]
  );

  const handleBuy = async () => {
    if (!user) {
      const root = navigation.getParent?.();
      (root || navigation).navigate('Login');
      return;
    }
    try {
      await api.post('/transactions', {
        listing: listing._id,
        transactionType: 'buy_request',
      });
      Alert.alert('Request sent', 'Your buy request was sent to the seller.');
      onChanged?.();
    } catch (err) {
      Alert.alert('Unable to buy', err.response?.data?.message || 'Failed to send buy request.');
    }
  };

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <Pressable onPress={() => onView?.(listing)} style={({ pressed }) => [styles.press, pressed && { opacity: 0.9 }]}>
        <View style={styles.imageWrap}>
          {listing.images?.[0]?.url ? (
            <Image source={{ uri: listing.images[0].url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <ImageIcon size={30} color={colors.faint} />
              <Text style={styles.fallbackText}>No image</Text>
            </View>
          )}
          <View style={styles.imageShade} />
          <View style={styles.topBadges}>
            <Badge tone={typeTone[listing.listingType] || 'muted'} style={styles.badge}>
              {getListingTypeLabel(listing.listingType)}
            </Badge>
            {status !== 'active' && (
              <Badge tone={status === 'sold' ? 'muted' : 'danger'} style={styles.badge}>{status}</Badge>
            )}
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.price}>{priceText}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={commonStyles.between}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text numberOfLines={1} style={styles.title}>{listing.title}</Text>
              {!!listing.description && (
                <Text numberOfLines={2} style={styles.description}>{listing.description}</Text>
              )}
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaItem icon={TypeIcon} text={getCategoryLabel(listing.category)} />
            {typeof listing.distance_km === 'number' && (
              <MetaItem icon={MapPin} text={`${listing.distance_km.toFixed(1)} km`} />
            )}
            {isAuction && listing.auction?.endTime && listing.auction?.status !== 'ended' && (
              <MetaItem icon={Clock3} text={timeRemaining(listing.auction.endTime)} />
            )}
            {isRental && <MetaItem icon={Package} text="Per day" />}
          </View>

          <View style={styles.actions}>
            {canBuy && (
              <AppButton title="Buy Now" icon={ShoppingBag} onPress={handleBuy} style={styles.buyButton} />
            )}
            <AppButton title="View" icon={Eye} variant="outline" onPress={() => onView?.(listing)} style={styles.viewButton} />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const MetaItem = ({ icon: Icon, text }) => (
  <View style={styles.metaItem}>
    <Icon size={13} color={colors.muted} strokeWidth={2.5} />
    <Text numberOfLines={1} style={styles.metaText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.75)',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  compactCard: {
    marginBottom: spacing.md,
  },
  press: {
    backgroundColor: 'transparent',
  },
  imageWrap: {
    position: 'relative',
    height: 190,
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  fallbackText: {
    color: colors.faint,
    fontWeight: '700',
  },
  imageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: 'rgba(2,6,23,0.14)',
  },
  topBadges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pricePill: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(2,6,23,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  description: {
    color: '#cbd5e1',
    lineHeight: 19,
    marginTop: 3,
  },
  price: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaItem: {
    minHeight: 28,
    maxWidth: '48%',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  buyButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  viewButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
});

export default ListingCard;
