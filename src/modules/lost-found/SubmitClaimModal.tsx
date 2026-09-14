import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database } from '../../types/database.types';

type FoundItem = Database['public']['Tables']['found_items']['Row'];

interface SubmitClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  foundItem: FoundItem | null;
}

export const SubmitClaimModal: React.FC<SubmitClaimModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  foundItem,
}) => {
  const { user } = useAuth();
  const [proofDescription, setProofDescription] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!foundItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!proofDescription.trim()) {
      setError('Proof description is required to verify ownership.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('claims').insert({
        found_item_id: foundItem.id,
        claimant_id: user.id,
        proof_description: proofDescription.trim(),
        proof_image_urls: proofImageUrl.trim() ? [proofImageUrl.trim()] : [],
        status: 'PENDING',
      } as any);

      if (insertError) throw insertError;

      onSuccess();
      onClose();
      setProofDescription('');
      setProofImageUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Item Ownership"
      description={`Submit proof of ownership for "${foundItem.title}".`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">Found Item Information</p>
          <p className="text-slate-600 dark:text-slate-400">Found At: {foundItem.found_location}</p>
          <p className="text-slate-600 dark:text-slate-400">Deposited At: {foundItem.current_location}</p>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Proof of Ownership & Identification Details *
          </label>
          <textarea
            rows={4}
            required
            placeholder="Explain unique details that only the true owner would know: wallpaper/passcode on device, brand serial, unique scratches, contents of bag, sticker placement..."
            value={proofDescription}
            onChange={(e) => setProofDescription(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Supporting Image / Receipt URL (Optional)
          </label>
          <input
            type="url"
            placeholder="URL to purchase receipt or previous photo of item"
            value={proofImageUrl}
            onChange={(e) => setProofImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} variant="primary">
            Submit Claim for Verification
          </Button>
        </div>
      </form>
    </Modal>
  );
};
