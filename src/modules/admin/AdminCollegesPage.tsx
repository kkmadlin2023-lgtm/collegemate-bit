import React, { useState, useEffect } from 'react';
import {
  School,
  Merge,
  Plus,
  Users,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';

interface CollegeGroup {
  name: string;
  studentCount: number;
  aliases: string[];
}

export const AdminCollegesPage: React.FC = () => {
  const { user } = useAuth();
  const [colleges, setColleges] = useState<CollegeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Merge modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [targetCanonicalName, setTargetCanonicalName] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  // Add College Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCollegeName, setNewCollegeName] = useState('');
  const [newCollegeCode, setNewCollegeCode] = useState('');

  const fetchCollegeStats = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles to aggregate college names
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('college_name');

      // 2. Fetch master colleges table
      const { data: collegesData } = await supabase
        .from('colleges')
        .select('*');

      // Group counts
      const countsMap: { [name: string]: number } = {};
      profilesData?.forEach((p: any) => {
        const cName = p.college_name?.trim();
        if (cName) {
          countsMap[cName] = (countsMap[cName] || 0) + 1;
        }
      });

      // Combine with master colleges table
      const list: CollegeGroup[] = [];
      const seen = new Set<string>();

      collegesData?.forEach((c: any) => {
        seen.add(c.name);
        list.push({
          name: c.name,
          studentCount: countsMap[c.name] || 0,
          aliases: c.aliases || [],
        });
      });

      // Add any distinct profile colleges not in master table yet
      Object.keys(countsMap).forEach((name) => {
        if (!seen.has(name)) {
          list.push({
            name,
            studentCount: countsMap[name],
            aliases: [],
          });
        }
      });

      setColleges(list.sort((a, b) => b.studentCount - a.studentCount));
    } catch (err) {
      console.error('Error fetching colleges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollegeStats();
  }, []);

  const handleToggleSource = (name: string) => {
    if (selectedSources.includes(name)) {
      setSelectedSources(selectedSources.filter((s) => s !== name));
    } else {
      setSelectedSources([...selectedSources, name]);
    }
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCanonicalName.trim() || selectedSources.length === 0) return;

    setMerging(true);
    setMergeMessage(null);

    try {
      const canonical = targetCanonicalName.trim();

      // Call stored procedure or direct updates
      const { error: rpcError } = await supabase.rpc('merge_colleges', {
        target_name: canonical,
        source_names: selectedSources,
      });

      if (rpcError) {
        // Fallback direct update
        await supabase
          .from('profiles')
          .update({ college_name: canonical } as any)
          .in('college_name', selectedSources);

        await supabase.from('colleges').upsert(
          {
            name: canonical,
            aliases: selectedSources,
          } as any,
          { onConflict: 'name' }
        );
      }

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: 'COLLEGES_MERGED',
        target_table: 'profiles',
        details: { target: canonical, mergedSources: selectedSources },
      } as any);

      setMergeMessage(`Successfully merged ${selectedSources.length} college name variations into "${canonical}"!`);
      setSelectedSources([]);
      setTargetCanonicalName('');
      setTimeout(() => {
        setIsMergeModalOpen(false);
        setMergeMessage(null);
        fetchCollegeStats();
      }, 1500);
    } catch (err: any) {
      console.error('Error merging colleges:', err);
    } finally {
      setMerging(false);
    }
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollegeName.trim()) return;

    try {
      await supabase.from('colleges').insert({
        name: newCollegeName.trim(),
        code: newCollegeCode.trim() || null,
      } as any);

      fetchCollegeStats();
      setIsAddModalOpen(false);
      setNewCollegeName('');
      setNewCollegeCode('');
    } catch (err) {
      console.error('Error adding college:', err);
    }
  };

  const filteredColleges = colleges.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            College Directory & Campus Merging
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Standardize college names and merge different variations of the same college into one unified campus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedSources.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Merge className="w-4 h-4" />}
              onClick={() => {
                setTargetCanonicalName(selectedSources[0]);
                setIsMergeModalOpen(true);
              }}
            >
              Merge Selected ({selectedSources.length})
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Campus
          </Button>
        </div>
      </div>

      {/* Merge Helper Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex items-start gap-3">
        <School className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-0.5">
          <p className="font-bold">How College Merging Works:</p>
          <p className="text-indigo-700 dark:text-indigo-300">
            If students registered with spelling variations like <span className="font-mono font-semibold">"BIT"</span>, <span className="font-mono font-semibold">"Bannari Amman"</span>, and <span className="font-mono font-semibold">"Bannari Amman Institute of Technology"</span>, select them using the checkboxes below and click <strong>Merge Selected</strong> to unify all their accounts under one official college name.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search college names or aliases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
        />
      </div>

      {/* Colleges List */}
      <Card className="p-0 overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Select</th>
                <th className="py-3 px-4">Official College / University Name</th>
                <th className="py-3 px-4">Enrolled Students</th>
                <th className="py-3 px-4">Known Aliases / Spellings</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Loading colleges...
                  </td>
                </tr>
              ) : filteredColleges.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No colleges found.
                  </td>
                </tr>
              ) : (
                filteredColleges.map((col) => {
                  const isSelected = selectedSources.includes(col.name);
                  return (
                    <tr
                      key={col.name}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSource(col.name)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <School className="w-4 h-4 text-indigo-600" />
                          <span>{col.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {col.studentCount} student{col.studentCount !== 1 ? 's' : ''}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {col.aliases && col.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {col.aliases.map((alias, i) => (
                              <Badge key={i} variant="neutral" size="sm">
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedSources([col.name]);
                            setTargetCanonicalName(col.name);
                            setIsMergeModalOpen(true);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          Merge Into...
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Merge Modal */}
      <Modal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="Merge College Variations"
        description="Standardize student accounts under one unified college title."
      >
        <form onSubmit={handleMergeSubmit} className="space-y-4">
          {mergeMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{mergeMessage}</span>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Selected Name Variations to Merge ({selectedSources.length})
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 max-h-36 overflow-y-auto">
              {selectedSources.map((name) => (
                <div key={name} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                  <span>• {name}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSource(name)}
                    className="text-rose-500 hover:text-rose-700 font-bold text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Target Official College Name *"
            placeholder="e.g. Bannari Amman Institute of Technology (BIT)"
            value={targetCanonicalName}
            onChange={(e) => setTargetCanonicalName(e.target.value)}
            required
          />

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">⚠️ Action Summary:</p>
            <p>
              All student profiles currently linked to any of the selected source names will be automatically updated to <strong>"{targetCanonicalName}"</strong>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={merging} leftIcon={<Merge className="w-4 h-4" />}>
              Confirm Merge
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add College Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Campus"
        description="Add a pre-approved college to the campus dropdown list."
      >
        <form onSubmit={handleAddCollege} className="space-y-4">
          <Input
            label="Full College Name *"
            placeholder="e.g. Bannari Amman Institute of Technology"
            value={newCollegeName}
            onChange={(e) => setNewCollegeName(e.target.value)}
            required
          />

          <Input
            label="College Short Code (Optional)"
            placeholder="e.g. BIT"
            value={newCollegeCode}
            onChange={(e) => setNewCollegeCode(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Campus</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
