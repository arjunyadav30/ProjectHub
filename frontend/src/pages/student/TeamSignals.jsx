import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, SkeletonCard } from '../../components/common';
import { contributionAPI } from '../../api';
import TeamHealthPanel from '../evaluation/TeamHealthPanel';
import { errorMessage } from '../evaluation/shared';

const EMPTY_LIST = [];

const TeamSignals = ({ teamId, members = EMPTY_LIST, authorMap = EMPTY_LIST }) => {
  const accepted = members.filter(member => member.status === 'accepted');
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMappings(accepted.map(member => {
      const student = member.student_id || {};
      const saved = authorMap.find(item => String(item.student_id?._id || item.student_id) === String(student._id || student));
      return { student_id: String(student._id || student), name: student.name || 'Team member', github_login: saved?.github_login || '', emails: (saved?.emails || []).join(', ') };
    }));
    setLoading(false);
  }, [teamId, members, authorMap]);
  const save = async () => {
    setSaving(true);
    try {
      await contributionAPI.setAuthorMap(teamId, mappings.map(item => ({ student_id: item.student_id, github_login: item.github_login.trim(), emails: item.emails.split(',').map(email => email.trim()).filter(Boolean) })));
      toast.success('GitHub identities saved');
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4">
    <TeamHealthPanel teamId={teamId} />
    <section className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">GitHub identity</h2><p className="text-sm text-gray-500">Used to attribute your commits correctly.</p>
      {loading ? <SkeletonCard /> : mappings.map((mapping,index)=><div key={mapping.student_id||index} className="grid sm:grid-cols-3 gap-2">
        <p className="text-sm self-center">{mapping.name}</p>
        <input aria-label={`${mapping.name} GitHub username`} className="input" placeholder="GitHub username" value={mapping.github_login} onChange={e=>setMappings(prev=>prev.map((m,i)=>i===index?{...m,github_login:e.target.value}:m))}/>
        <input aria-label={`${mapping.name} GitHub emails`} className="input" placeholder="Optional emails, comma-separated" value={mapping.emails} onChange={e=>setMappings(prev=>prev.map((m,i)=>i===index?{...m,emails:e.target.value}:m))}/>
      </div>)}
      <Button loading={saving} disabled={loading} onClick={save}>Save GitHub mapping</Button>
    </section>
  </div>;
};
export default TeamSignals;
