import React, { useState, useEffect, useMemo } from 'react';
import {
  School,
  Merge,
  Plus,
  Users,
  CheckCircle2,
  Search,
  Trash2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
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
  const [activeTab, setActiveTab] = useState<'directory' | 'merge' | 'add'>('directory');

  // Merge state
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [targetCanonicalName, setTargetCanonicalName] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add College state
  const [newCollegeName, setNewCollegeName] = useState('');
  const [newCollegeCode, setNewCollegeCode] = useState('');
  const [addingCollege, setAddingCollege] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deleting state
  const [deletingName, setDeletingName] = useState<string | null>(null);

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

  // Handle Safe Deletion of 0-User Colleges
  const handleDeleteEmptyCollege = async (collegeName: string) => {
    if (!confirm(`Are you sure you want to delete campus "${collegeName}"?\n\nThis campus has 0 enrolled students and will be permanently removed.`)) {
      return;
    }

    setDeletingName(collegeName);
    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('delete_college_if_empty', {
        p_college_name: collegeName,
      });

      if (rpcErr) {
        console.warn('RPC delete failed, using direct delete fallback:', rpcErr.message);
        // Verify 0 users before deleting directly
        const { count, error: countErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('college_name', collegeName);

        if (countErr) throw countErr;
        if (count && count > 0) {
          alert(`Cannot delete "${collegeName}": ${count} active students are registered. Merge them first.`);
          return;
        }

        const { error: deleteErr } = await supabase
          .from('colleges')
          .delete()
          .eq('name', collegeName);

        if (deleteErr) throw deleteErr;
      }

      setColleges((prev) => prev.filter((c) => c.name !== collegeName));
      alert(`Campus "${collegeName}" successfully removed.`);
    } catch (err: any) {
      console.error('Error deleting college:', err);
      alert(err.message || 'Failed to delete campus.');
    } finally {
      setDeletingName(null);
    }
  };

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

      const { error: rpcError } = await supabase.rpc('merge_colleges', {
        target_name: canonical,
        source_names: selectedSources,
      });

      if (rpcError) {
        // Direct fallback update
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

      if (user) {
        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: 'COLLEGES_MERGED',
          target_table: 'profiles',
          details: { target: canonical, mergedSources: selectedSources },
        } as any);
      }

      setMergeMessage({
        type: 'success',
        text: `Successfully merged ${selectedSources.length} college name variations into "${canonical}"!`,
      });
      setSelectedSources([]);
      setTargetCanonicalName('');
      fetchCollegeStats();
    } catch (err: any) {
      console.error('Error merging colleges:', err);
      setMergeMessage({
        type: 'error',
        text: err.message || 'Failed to merge colleges.',
      });
    } finally {
      setMerging(false);
    }
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollegeName.trim()) return;

    setAddingCollege(true);
    setAddMessage(null);

    try {
      const { error } = await supabase.from('colleges').insert({
        name: newCollegeName.trim(),
        code: newCollegeCode.trim() || null,
        is_active: true,
      } as any);

      if (error) throw error;

      setAddMessage({
        type: 'success',
        text: `Campus "${newCollegeName.trim()}" registered successfully!`,
      });
      setNewCollegeName('');
      setNewCollegeCode('');
      fetchCollegeStats();
    } catch (err: any) {
      console.error('Error adding college:', err);
      setAddMessage({
        type: 'error',
        text: err.message || 'Failed to add college.',
      });
    } finally {
      setAddingCollege(false);
    }
  };

  const filteredColleges = useMemo(() => {
    return colleges.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [colleges, searchQuery]);

  const zeroUserCount = colleges.filter((c) => c.studentCount === 0).length;
  const activeCampusesCount = colleges.filter((c) => c.studentCount > 0).length;
  const totalEnrolledStudents = colleges.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <School className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Campus & University Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize university listings, safely delete unused entries (0 users), and merge duplicate campus variations.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={fetchCollegeStats}
          leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh Data
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Total Listed</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{colleges.length}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Campuses</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{activeCampusesCount}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">0-User Unused</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{zeroUserCount}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
          <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Enrolled Students</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalEnrolledStudents}</h4>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl max-w-fit">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'directory'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          🏢 Campus Directory ({colleges.length})
        </button>
        <button
          onClick={() => setActiveTab('merge')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'merge'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          🔄 Clean Merge Tool {selectedSources.length > 0 && `(${selectedSources.length} selected)`}
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'add'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          ➕ Register Campus
        </button>
      </div>

      {/* TAB 1: Campus Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search campus names, aliases, or acronyms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{filteredColleges.length}</span> of {colleges.length} campuses
            </div>
          </div>

          {/* Clean Table View */}
          <Card className="p-0 overflow-hidden border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Campus Name</th>
                    <th className="py-3 px-4">Aliases / Variations</th>
                    <th className="py-3 px-4">Enrolled Students</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Loading campus directory...
                      </td>
                    </tr>
                  ) : filteredColleges.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        No campuses matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredColleges.map((college) => {
                      const isZero = college.studentCount === 0;
                      const isDeleting = deletingName === college.name;

                      return (
                        <tr key={college.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <School className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                              <span>{college.name}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {college.aliases && college.aliases.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {college.aliases.map((a) => (
                                  <span
                                    key={a}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]"
                                  >
                                    {a}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No alias</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isZero ? (
                              <Badge variant="neutral" size="sm">
                                0 Students (Unused)
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                <Users className="w-3 h-3 mr-1" /> {college.studentCount} Students
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {/* Merge shortcut */}
                              <button
                                onClick={() => {
                                  setSelectedSources([college.name]);
                                  setTargetCanonicalName(college.name);
                                  setActiveTab('merge');
                                }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-indigo-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                                title="Merge duplicate variations"
                              >
                                Merge...
                              </button>

                              {/* Delete Option for 0-User Colleges */}
                              {isZero ? (
                                <button
                                  onClick={() => handleDeleteEmptyCollege(college.name)}
                                  disabled={isDeleting}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors flex items-center gap-1"
                                  title="Permanently delete unused campus (0 users)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{isDeleting ? 'Deleting...' : 'Delete (0 Users)'}</span>
                                </button>
                              ) : (
                                <span
                                  className="text-[10px] text-slate-400 italic"
                                  title="Active students enrolled. Merge to another campus before deleting."
                                >
                                  In Use
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Clean Merge Tool */}
      {activeTab === 'merge' && (
        <Card className="p-6 space-y-6 max-w-3xl mx-auto border shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-indigo-600" />
              Clean Campus Name Consolidation Tool
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select multiple informal or misspelled college variations and consolidate all enrolled student profiles into one official canonical campus name.
            </p>
          </div>

          {mergeMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                mergeMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200'
              }`}
            >
              {mergeMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span>{mergeMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleMergeSubmit} className="space-y-5">
            {/* Step 1: Select Source Variations */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Step 1: Select Source College Variations to Merge ({selectedSources.length} selected)
              </label>

              <div className="max-h-56 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                {colleges.map((c) => {
                  const isChecked = selectedSources.includes(c.name);
                  return (
                    <label
                      key={c.name}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-indigo-50 border-indigo-500/50 dark:bg-indigo-950/40 dark:border-indigo-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSource(c.name)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {c.name}
                        </span>
                      </div>
                      <Badge variant={c.studentCount > 0 ? 'success' : 'neutral'} size="sm">
                        {c.studentCount} students
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Destination Canonical Name */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Step 2: Destination Official Canonical Campus Name *
              </label>
              <Input
                placeholder="e.g. Bannari Amman Institute of Technology (BIT)"
                value={targetCanonicalName}
                onChange={(e) => setTargetCanonicalName(e.target.value)}
                leftIcon={<School className="w-4 h-4 text-indigo-500" />}
                required
              />

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Quick presets:</span>
                {colleges.slice(0, 4).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setTargetCanonicalName(c.name)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="submit"
                isLoading={merging}
                disabled={selectedSources.length === 0 || !targetCanonicalName.trim()}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Execute Safe Consolidation ({selectedSources.length} Variations)
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 3: Register Campus */}
      {activeTab === 'add' && (
        <Card className="p-6 space-y-6 max-w-lg mx-auto border shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              Register New Official Campus
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add a new official institution to the master dropdown for student onboarding.
            </p>
          </div>

          {addMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                addMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{addMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleAddCollege} className="space-y-4">
            <Input
              label="Official Campus Name *"
              placeholder="e.g. PSG College of Technology"
              value={newCollegeName}
              onChange={(e) => setNewCollegeName(e.target.value)}
              leftIcon={<School className="w-4 h-4 text-indigo-500" />}
              required
            />

            <Input
              label="Campus Code / Acronym (Optional)"
              placeholder="e.g. PSGTECH / BIT / CIT"
              value={newCollegeCode}
              onChange={(e) => setNewCollegeCode(e.target.value)}
            />

            <div className="pt-2 flex justify-end">
              <Button type="submit" isLoading={addingCollege} leftIcon={<Plus className="w-4 h-4" />}>
                Register Campus
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
