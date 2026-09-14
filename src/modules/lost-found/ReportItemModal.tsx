import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { ImageUploader } from '../../components/common/ImageUploader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { showLocalDeviceNotification } from '../../lib/firebase';
import type { Database, ItemType } from '../../types/database.types';
import { School } from 'lucide-react';

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
  const { user, profile } = useAuth();
  const [itemType, setItemType] = useState<ItemType>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [collegeName, setCollegeName] = useState(profile?.college_name || '');
  const [currentLocation, setCurrentLocation] = useState('Campus Security Office');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [rewardOrContact, setRewardOrContact] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [colleges, setColleges] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemType(defaultType);
    if (profile?.college_name) {
      setCollegeName(profile.college_name);
    }
  }, [defaultType, isOpen, profile?.college_name]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'LOST_FOUND')
        .eq('is_active', true);
      if (catData) setCategories(catData);

      // Fetch distinct colleges for dropdown suggestion
      const { data: collegeData } = await supabase
        .from('colleges')
        .select('name')
        .eq('is_active', true);
      if (collegeData) {
        setColleges(collegeData.map((c) => c.name));
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError('Title, description, and location are required.');
      return;
    }

    const assignedCollege = collegeName.trim() || profile?.college_name || 'Bannari Amman Institute of Technology (BIT)';

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
          college_name: assignedCollege,
          lost_date: isoDate,
          image_urls: imageUrls,
          reward_offered: rewardOrContact.trim() || null,
          contact_info: user.email || null,
          category_id: categoryId || null,
          status: 'APPROVED', // Immediately visible to campus
        } as any);

        if (insertError) throw insertError;

        // In-app notification for the user
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: `🔍 Lost Item Listed: ${title.trim()}`,
          body: `Your lost item has been published to ${assignedCollege}. Other students can view and contact you.`,
          type: 'LOST_FOUND_ALERT',
          data: { type: 'LOST', college: assignedCollege },
          expires_at: expiresAt.toISOString(),
        } as any);

        showLocalDeviceNotification(
          '🔍 Lost Item Listed Successfully!',
          `Your report for "${title.trim()}" is now live on the ${assignedCollege} campus board.`
        );
      } else {
        const { error: insertError } = await supabase.from('found_items').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          found_location: location.trim(),
          current_location: currentLocation.trim() || 'Campus Security Office',
          college_name: assignedCollege,
          found_date: isoDate,
          image_urls: imageUrls,
          handover_notes: rewardOrContact.trim() || null,
          category_id: categoryId || null,
          status: 'APPROVED', // Immediately visible to campus
        } as any);

        if (insertError) throw insertError;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: `🎉 Found Item Deposited: ${title.trim()}`,
          body: `Your found item report has been published to ${assignedCollege} (Deposited at: ${currentLocation.trim()}).`,
          type: 'LOST_FOUND_ALERT',
          data: { type: 'FOUND', college: assignedCollege },
          expires_at: expiresAt.toISOString(),
        } as any);

        showLocalDeviceNotification(
          '🎉 Found Item Report Published!',
          `Item "${title.trim()}" is now visible to students looking for their misplaced belongings.`
        );
      }

      onSuccess();
      onClose();
      setTitle('');
      setDescription('');
      setLocation('');
      setRewardOrContact('');
      setImageUrls([]);
    } catch (err: any) {
      console.error('Error submitting report:', err);
      setError(err.message || 'Failed to submit report.');
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
      description="Published immediately to your campus directory so classmates and campus staff can help recover it."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
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

        {/* College Name Selection */}
        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> College / University Campus *
          </label>
          <input
            type="text"
            list="college-list"
            required
            placeholder="e.g. Bannari Amman Institute of Technology (BIT)"
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <datalist id="college-list">
            {colleges.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-[11px] text-slate-400">
            This item will be tagged with this college so campus peers can identify it quickly.
          </p>
        </div>

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

        {/* Photo Upload from Device / Camera */}
        <ImageUploader
          images={imageUrls}
          onChange={setImageUrls}
          maxImages={4}
          folder="lost-found"
          label="Item Photos (Choose from Device or Take Photo)"
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} variant={itemType === 'LOST' ? 'danger' : 'success'}>
            Publish Live Report
          </Button>
        </div>
      </form>
    </Modal>
  );
};
