import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { userAPI } from '../api';
import { DashboardLayout } from '../components/common/Layout';
import { Badge } from '../components/common';
import { Search, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';

const People = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      userAPI.searchPeople(q)
        .then(res => setResults(res.data.data || []))
        .catch(() => toast.error('Search failed'))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">People</h1>
          <p className="text-sm text-gray-500 mt-1">Search users and view readonly profiles.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by name or email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {query.trim().length < 2 ? (
            <div className="card p-12 text-center text-gray-400">
              <UserRound className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Type at least 2 characters to search.</p>
            </div>
          ) : loading ? (
            [1,2,3].map(i => <div key={i} className="card p-5 h-20 animate-pulse bg-gray-200 dark:bg-gray-700" />)
          ) : results.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">No users found.</div>
          ) : (
            results.map(person => (
              <Link key={person._id} to={`/people/${person._id}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold overflow-hidden">
                  {person.profile_image
                    ? <img src={person.profile_image} alt="" className="w-full h-full object-cover" />
                    : person.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{person.name}</p>
                  <p className="text-sm text-gray-500 truncate">{person.email}</p>
                </div>
                <Badge variant="default">{person.role}</Badge>
              </Link>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default People;
