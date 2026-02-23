import { useEffect, useState } from 'react';
import api from '../services/api';

const createEmptyForm = () => ({
  title: '',
  description: '',
  price: 0,
  category: 'physical',
  condition: 'good',
  listingType: 'buy-now',
  tags: '',
  auction: {
    startBid: 0,
    endTime: '',
  },
});

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const mapListingToForm = (listing) => {
  if (!listing) return createEmptyForm();
  return {
    title: listing.title || '',
    description: listing.description || '',
    price: listing.price ?? 0,
    category: listing.category || 'physical',
    condition: listing.condition || 'good',
    listingType: listing.listingType || 'buy-now',
    tags: Array.isArray(listing.tags) ? listing.tags.join(', ') : listing.tags || '',
    auction: {
      startBid: listing.auction?.startBid ?? 0,
      endTime: toLocalDateTime(listing.auction?.endTime) || '',
    },
  };
};

const ListingForm = ({ onCreated, onSuccess, initialData, mode = 'create' }) => {
  const [form, setForm] = useState(initialData ? mapListingToForm(initialData) : createEmptyForm());
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm(mapListingToForm(initialData));
    } else if (mode === 'create') {
      setForm(createEmptyForm());
    }
  }, [initialData, mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuctionChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = {
        ...prev,
        auction: { ...prev.auction, [name]: value },
      };
      // For auction type, derive price from startBid
      if (prev.listingType === 'auction' && name === 'startBid') {
        const n = Number(value) || 0;
        if (next.price !== n) next.price = n;
      }
      return next;
    });
  };

  // Keep price synced to startBid for auction type
  useEffect(() => {
    if (form.listingType === 'auction') {
      const n = Number(form.auction.startBid) || 0;
      if (form.price !== n) {
        setForm((prev) => ({ ...prev, price: n }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.listingType, form.auction.startBid]);

  const uploadImage = async (listingId) => {
    if (!image) return null;
    const formData = new FormData();
    formData.append('image', image);
    const { data } = await api.post(`/listings/${listingId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      // Include auction data when auction type selected
      if (form.listingType === 'auction') {
        // Only send editable auction fields, not bid data
        payload.auction = {
          isAuction: true,
          startBid: Number(form.auction.startBid),
          endTime: form.auction.endTime ? new Date(form.auction.endTime).toISOString() : undefined,
        };
        // Derive price from startBid for auction listings
        payload.price = Number(form.auction.startBid) || 0;
      }

      let response;
      let listingId;
      if (mode === 'edit' && initialData?._id) {
        // For edit mode with new image, send as FormData
        if (image) {
          setUploading(true);
          const formData = new FormData();
          
          // Append all form fields to FormData
          Object.keys(payload).forEach(key => {
            if (key === 'auction' && payload.auction) {
              formData.append('auction', JSON.stringify(payload.auction));
            } else if (key === 'tags' && Array.isArray(payload.tags)) {
              formData.append('tags', payload.tags.join(','));
            } else {
              formData.append(key, payload[key]);
            }
          });
          
          // Append the image file
          formData.append('images', image);
          
          response = await api.put(`/listings/${initialData._id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setUploading(false);
        } else {
          // No new image, send JSON payload
          response = await api.put(`/listings/${initialData._id}`, payload);
        }
        listingId = initialData._id;
      } else {
        // Create mode
        response = await api.post('/listings', payload);
        listingId = response.data._id;
        
        // Upload image after creation
        if (image) {
          setUploading(true);
          try {
            await uploadImage(listingId);
          } finally {
            setUploading(false);
          }
        }
      }

      if (mode === 'create') {
        setForm(createEmptyForm());
        setImage(null);
      } else if (response?.data) {
        setForm(mapListingToForm(response.data));
        setImage(null);
      }

      onSuccess?.(response?.data);
      onCreated?.(response?.data);
    } catch (err) {
      const fallback = mode === 'edit' ? 'Failed to update listing' : 'Failed to create listing';
      const validationErrors = err.response?.data?.errors;
      if (Array.isArray(validationErrors) && validationErrors.length) {
        const combinedMessage = validationErrors
          .map((issue) => issue?.msg || issue?.message || issue?.param)
          .filter(Boolean)
          .join('. ');
        setError(combinedMessage || fallback);
      } else {
        setError(err.response?.data?.message || fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-2xl shadow-black/30">
      {error && <p className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
      <div>
        <label className="text-sm font-medium text-slate-300">Title</label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
          minLength={3}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-300">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
          rows="4"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {form.listingType !== 'auction' ? (
          <div>
            <label className="text-sm font-medium text-slate-300">Price</label>
            <input
              name="price"
              type="number"
              min="0"
              value={form.price}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required
            />
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-300">Price (derived from Starting Bid)</label>
            <input
              type="number"
              value={Number(form.auction.startBid) || 0}
              disabled
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900/40 px-3 py-2 text-slate-400"
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-slate-300">Category</label>
          <select name="category" value={form.category} onChange={handleChange} className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100">
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
            <option value="ticket">Ticket</option>
            <option value="merch">Merch</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-300">Condition</label>
          <select
            name="condition"
            value={form.condition}
            onChange={handleChange}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
          >
            <option value="new">New</option>
            <option value="like-new">Like New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300">Listing Type</label>
          <select
            name="listingType"
            value={form.listingType}
            onChange={handleChange}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
          >
            <option value="buy-now">Buy Now</option>
            <option value="auction">Auction</option>
          </select>
        </div>
      </div>
      {form.listingType === 'auction' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded border border-slate-700 bg-slate-800/40 p-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Starting Bid (₹)</label>
            <input
              name="startBid"
              type="number"
              min="0"
              value={form.auction.startBid}
              onChange={handleAuctionChange}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required={form.listingType === 'auction'}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">End Time</label>
            <input
              name="endTime"
              type="datetime-local"
              value={form.auction.endTime}
              onChange={handleAuctionChange}
              min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required={form.listingType === 'auction'}
            />
          </div>
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-slate-300">Tags (comma separated)</label>
        <input
          name="tags"
          value={form.tags}
          onChange={handleChange}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-300">Image</label>
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])} className="mt-1 w-full text-slate-400" />
      </div>
      <button
        type="submit"
        className="w-full rounded-full bg-brand-primary py-3 text-white shadow shadow-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={uploading || submitting}
      >
        {uploading ? 'Uploading…' : submitting ? 'Submitting…' : mode === 'edit' ? 'Update Listing' : 'Create Listing'}
      </button>
    </form>
  );
};

export default ListingForm;
