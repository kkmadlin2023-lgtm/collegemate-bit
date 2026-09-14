import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database } from '../../types/database.types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';

type Category = Database['public']['Tables']['categories']['Row'];

export const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<'SCHEDULE' | 'REMINDER' | 'LOST_FOUND' | 'GENERAL'>('SCHEDULE');
  const [color, setColor] = useState('#4f46e5');
  const [description, setDescription] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: true });

      if (!error && data) setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const generatedSlug = slug.trim() || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
      await supabase.from('categories').insert({
        name: name.trim(),
        slug: generatedSlug,
        type,
        color,
        description: description.trim() || null,
        is_active: true,
      } as any);

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: 'CATEGORY_CREATED',
        target_table: 'categories',
        details: { name, type, slug: generatedSlug },
      } as any);

      fetchCategories();
      setIsModalOpen(false);
      setName('');
      setSlug('');
      setDescription('');
    } catch (err) {
      console.error('Error creating category:', err);
    }
  };

  const typeOptions = [
    { value: 'SCHEDULE', label: 'Schedule / Timetable' },
    { value: 'REMINDER', label: 'Tasks & Reminders' },
    { value: 'LOST_FOUND', label: 'Lost & Found' },
    { value: 'GENERAL', label: 'General' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Taxonomy & Category Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure system categories for class timetables, student tasks, and lost & found belongings.
          </p>
        </div>

        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
          New Category
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-xs text-slate-400">Loading categories...</p>
        ) : (
          categories.map((c) => (
            <Card key={c.id} className="p-4 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h4>
                  <Badge variant="indigo" size="sm">
                    {c.type}
                  </Badge>
                </div>
                {c.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                )}
                <p className="text-[10px] text-slate-400 font-mono">slug: {c.slug}</p>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Category"
        description="Add a new categorized tag to the system taxonomy."
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Workshop or Chemistry Lab"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Category Type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              options={typeOptions}
            />
            <Input
              label="Color Hex Code"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <Input
            label="Description (Optional)"
            placeholder="Brief explanation of this category"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Category</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
