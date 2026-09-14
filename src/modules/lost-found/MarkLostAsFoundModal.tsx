import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ImageUploader } from '../../components/common/ImageUploader';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { showLocalDeviceNotification } from '../../lib/firebase';
import type { Database } from '../../types/database.types';
import { CheckCircle2, MapPin, School, ShieldCheck, Sparkles } from 'lucide-react';

type LostItem = Database['public']['Tables']['lost_items']['Row'];

interface MarkLostAsFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lostItem: LostItem | null;
}

export const MarkLostAsFoundModal: React.FC<MarkLostAsFoundModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lostItem,
}) => {
  const { user } = useAuth();
  const [foundLocation, setFoundLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Campus Security Office');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lostItem) return null;

  const isOwner = user?.id === lostItem.user_id;

  const handleResolveAsOwner = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('lost_items')
        .update({ status: 'RESOLVED', updated_at: new Date().toISOString() } as any)
        .eq('id', lostItem.id);

      if (updateError) throw updateError;

      showLocalDeviceNotification(
        '🎉 Item Recovered!',
        `"${lostItem.title}" has been marked as recovered by you.`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error resolving lost item:', err);
      setError(err.message || 'Failed to resolve item.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsFoundByFinder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!foundLocation.trim() || !currentLocation.trim()) {
      setError('Please provide where the item was found and where it is deposited.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try calling the PostgreSQL RPC first
      const { error: rpcErr } = await supabase.rpc('mark_lost_item_as_found', {
        p_lost_item_id: lostItem.id,
        p_found_location: foundLocation.trim(),
        p_current_location: currentLocation.trim(),
        p_handover_notes: handoverNotes.trim() || 'Deposited at campus desk for owner pickup.',
        p_image_urls: imageUrls.length > 0 ? imageUrls : lostItem.image_urls,
        p_finder_id: user.id,
      });

      if (rpcErr) {
        console.warn('RPC fallback to direct database insert:', rpcErr.message);

        // Fallback: Direct table operations
        // A. Insert into found_items
        const { error: insertErr } = await supabase.from('found_items').insert({
          user_id: user.id,
          title: lostItem.title,
          description: lostItem.description,
          found_location: foundLocation.trim(),
          current_location: currentLocation.trim(),
          college_name: lostItem.college_name,
          found_date: new Date().toISOString(),
          image_urls: imageUrls.length > 0 ? imageUrls : lostItem.image_urls,
          handover_notes: handoverNotes.trim() || 'Found and safely deposited.',
          category_id: lostItem.category_id,
          status: 'APPROVED',
        } as any);

        if (insertErr) throw insertErr;

        // B. Update lost item status to RESOLVED
        await supabase
          .from('lost_items')
          .update({ status: 'RESOLVED', updated_at: new Date().toISOString() } as any)
          .eq('id', lostItem.id);

        // C. Send notification to owner with 7-day retention
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase.from('notifications').insert({
          user_id: lostItem.user_id,
          title: `🎉 Great News! Your Lost Item Was Found: ${lostItem.title}`,
          body: `A fellow student found your item at ${foundLocation.trim()} and safely deposited it at: ${currentLocation.trim()}.`,
          type: 'LOST_FOUND_ALERT',
          data: { lost_item_id: lostItem.id },
          expires_at: expiresAt.toISOString(),
        } as any);
      }

      showLocalDeviceNotification(
        '🎉 Found Deposit Registered!',
        `Thank you for helping recover "${lostItem.title}"! The owner has been notified with pickup details.`
      );

      onSuccess();
      onClose();
      setFoundLocation('');
      setHandoverNotes('');
      setImageUrls([]);
    } catch (err: any) {
      console.error('Error marking lost item as found:', err);
      setError(err.message || 'Failed to submit found report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOwner ? 'Mark Misplaced Item as Recovered' : 'I Found This Item (Deposit & Notify Owner)'}
      description={`Item: "${lostItem.title}"`}
    >
      <div className="space-y-4 text-left">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        {/* Item Summary Card */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {lostItem.title}
            </span>
            {lostItem.college_name && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <School className="w-3.5 h-3.5" /> {lostItem.college_name}
              </span>
            )}
          </div>

          <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
            {lostItem.description}
          </p>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span>Originally lost at: {lostItem.last_seen_location}</span>
          </div>
        </div>

        {/* OWNER FLOW: Single-click recovery */}
        {isOwner ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Did you find or recover this belonging?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Marking this item as recovered will resolve the listing and archive the lost report.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Keep Listing Active
              </Button>
              <Button
                type="button"
                variant="success"
                size="sm"
                isLoading={loading}
                leftIcon={<Sparkles className="w-4 h-4" />}
                onClick={handleResolveAsOwner}
              >
                Yes, I Got It Back!
              </Button>
            </div>
          </div>
        ) : (
          /* FINDER FLOW: Submit found details & notify owner */
          <form onSubmit={handleMarkAsFoundByFinder} className="space-y-3.5">
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Thank you for helping a classmate!</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  When you submit this report, a new Found listing will be created and the owner will receive an instant 7-day push notification with pickup instructions.
                </p>
              </div>
            </div>

            <Input
              label="Where did you spot / find this item? *"
              placeholder="e.g. Under bench in 2nd Floor Library reading hall"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              required
            />

            <Input
              label="Where did you safely deposit it for the owner? *"
              placeholder="e.g. BIT Central Library Front Reception / Campus Main Security Desk"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Handover Notes & Contact / Instructions for Owner
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Handed to security guard Mr. Kumar with item tagged #42, available until 7 PM"
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="w-full px-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <ImageUploader
              images={imageUrls}
              onChange={setImageUrls}
              maxImages={3}
              folder="lost-found"
              label="Found Item Verification Photos (Optional)"
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="success"
                isLoading={loading}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Deposit & Notify Owner
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
