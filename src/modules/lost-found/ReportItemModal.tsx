import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, ItemType } from '../../types/database.types';

type Category = Database['public']['Tables']['categories']['Row'];

interface ReportItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: ItemType;
}

export const ReportItemModal: React.FC<ReportItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'LOST',
}) => {
  const { user } = useAuth();
  const [itemType, setItemType] = useState<ItemType>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Campus Security Office');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [rewardOrContact, setRewardOrContact] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemType(defaultType);
  }, [defaultType, isOpen]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'LOST_FOUND')
        .eq('is_active', true);
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImageUrls((prev) => [...prev, imageUrlInput.trim()]);
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError('Title, description, and location are required.');
      return;
    }

    setLoading(true);
    setError(null);

    const isoDate = new Date(eventDate).toISOString();

    try {
      if (itemType === 'LOST') {
        const { error: insertError } = await supabase.from('lost_items').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          last_seen_location: location.trim(),
          lost_date: isoDate,
          image_urls: imageUrls,
          reward_offered: rewardOrContact.trim() || null,
          contact_info: user.email || null,
          category_id: categoryId || null,
          status: 'PENDING',
        } as any);
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from('found_items').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          found_location: location.trim(),
          current_location: currentLocation.trim() || 'Campus Security Office',
          found_date: isoDate,
          image_urls: imageUrls,
          handover_notes: rewardOrContact.trim() || null,
          category_id: categoryId || null,
          status: 'PENDING',
        } as any);
        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
      setTitle('');
      setDescription('');
      setLocation('');
      setRewardOrContact('');
      setImageUrls([]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Select Category' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={itemType === 'LOST' ? 'Report Lost Belonging' : 'Report Found Item'}
      description="Listings are reviewed by campus moderators before being published publicly."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        {/* Item Type Switcher */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setItemType('LOST')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              itemType === 'LOST'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            I Lost Something
          </button>
          <button
            type="button"
            onClick={() => setItemType('FOUND')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              itemType === 'FOUND'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            I Found Something
          </button>
        </div>

        <Input
          label="Item Name / Title *"
          placeholder={itemType === 'LOST' ? 'e.g. Silver iPad Air 5 in blue magnetic case' : 'e.g. Set of dormitory keys with blue lanyard'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoryOptions}
          />
          <Input
            type="date"
            label={itemType === 'LOST' ? 'Date Lost' : 'Date Found'}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={itemType === 'LOST' ? 'Last Seen Location *' : 'Found Location *'}
            placeholder="e.g. Library 2nd Floor study room or Cafeteria"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          {itemType === 'FOUND' ? (
            <Input
              label="Currently Deposited At *"
              placeholder="e.g. Security Desk / Library Reception"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              required
            />
          ) : (
            <Input
              label="Reward Offered (Optional)"
              placeholder="e.g. $20 reward / free coffee"
              value={rewardOrContact}
              onChange={(e) => setRewardOrContact(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Detailed Description & Distinguishing Features *
          </label>
          <textarea
            rows={3}
            required
            placeholder="Describe brand, serial indicators, stickers, color nuances, scratches, or contents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* Image Attachment Section */}
        <div className="space-y-2 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Photo Image URL (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://images.unsplash.com/... or cloud image link"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="flex-1 px-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
            <Button type="button" size="sm" variant="secondary" onClick={handleAddImageUrl}>
              Add Photo
            </Button>
          </div>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={url} alt="Uploaded item" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} variant={itemType === 'LOST' ? 'danger' : 'success'}>
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
};
