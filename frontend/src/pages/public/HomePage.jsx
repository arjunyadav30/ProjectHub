import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicAPI } from '../../api';
import { GraduationCap, ExternalLink, Users, BookOpen, Github } from 'lucide-react';

const HomePage = () => {
  const [config, setConfig] = useState({ site_name: 'ProjectHub', logo_url: '', hero_image_url: '' });
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([publicAPI.getWebsiteConfig(), publicAPI.getFeaturedProjects()])
      .then(([cfgRes, projRes]) => {
        setConfig(cfgRes.data.data || {});
        setFeaturedProjects(projRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        {config.hero_image_url ? (
          <img src={config.hero_image_url} alt="hero" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-gray-900 to-purple-900" />
        )}
        <div className="absolute inset-0 bg-black/40" />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            {config.logo_url ? (
              <img src={config.logo_url} alt="logo" className="h-24 w-24 rounded-2xl shadow-2xl object-contain bg-white/10 p-2" />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <GraduationCap className="w-14 h-14 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {config.site_name || 'ProjectHub'}
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-xl mx-auto">
            College Project Management System — Collaborate, Track, Deliver.
          </p>

          {/* 3 Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-lg transition-all shadow-lg hover:shadow-blue-500/30 hover:scale-105"
            >
              Sign Up
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur text-white font-semibold rounded-xl text-lg border border-white/20 transition-all hover:scale-105"
            >
              Login
            </Link>
            <a
              href="#projects"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-lg transition-all shadow-lg hover:shadow-purple-500/30 hover:scale-105"
            >
              View Projects
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Featured Projects */}
      <section id="projects" className="py-20 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Featured Projects</h2>
            <p className="text-gray-400">Showcasing the best work from our students</p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="bg-gray-800 rounded-2xl p-6 animate-pulse">
                  <div className="h-6 bg-gray-700 rounded mb-3 w-3/4" />
                  <div className="h-4 bg-gray-700 rounded mb-2 w-full" />
                  <div className="h-4 bg-gray-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : featuredProjects.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-xl">No featured projects yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects.map((fp, i) => (
                <div key={i} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-900/20 group">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {fp.title || fp.team?.team_name}
                  </h3>
                  {fp.team?.event_id?.title && (
                    <p className="text-xs text-blue-400 mb-3 font-medium">{fp.team.event_id.title}</p>
                  )}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {fp.team?.project?.description || 'An amazing project by our students.'}
                  </p>

                  {/* Tech stack */}
                  {fp.team?.project?.technologies_used?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {fp.team.project.technologies_used.slice(0,4).map(tech => (
                        <span key={tech} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">{tech}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    {fp.deployed_link && (
                      <a href={fp.deployed_link} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4" /> Live Demo
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedProject(fp)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
                      <Users className="w-4 h-4" /> Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} {config.site_name || 'ProjectHub'}. College Project Management System.</p>
      </footer>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProject(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedProject.title || selectedProject.team?.team_name}</h2>
              <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-white p-1">✕</button>
            </div>

            {selectedProject.team?.project?.description && (
              <p className="text-gray-300 mb-4">{selectedProject.team.project.description}</p>
            )}

            {/* Team Members */}
            {selectedProject.team?.members?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Team Members</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.team.members.filter(m => m.status === 'accepted').map(m => (
                    <div key={m.student_id?._id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-blue-800 flex items-center justify-center text-blue-200 font-bold text-xs overflow-hidden">
                        {m.student_id?.profile_image
                          ? <img src={m.student_id.profile_image} className="w-full h-full object-cover" alt="" />
                          : m.student_id?.name?.[0]}
                      </div>
                      <span className="text-sm text-white">{m.student_id?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mentor */}
            {selectedProject.team?.assigned_faculty && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Mentor</h3>
                <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 inline-flex">
                  <div className="w-8 h-8 rounded-full bg-purple-800 flex items-center justify-center text-purple-200 font-bold overflow-hidden">
                    {selectedProject.team.assigned_faculty.profile_image
                      ? <img src={selectedProject.team.assigned_faculty.profile_image} className="w-full h-full object-cover" alt="" />
                      : selectedProject.team.assigned_faculty.name?.[0]}
                  </div>
                  <span className="text-white">{selectedProject.team.assigned_faculty.name}</span>
                </div>
              </div>
            )}

            {/* Modules */}
            {selectedProject.team?.project?.modules?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Modules</h3>
                <div className="space-y-2">
                  {selectedProject.team.project.modules.map(mod => (
                    <div key={mod._id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{mod.module_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mod.status === 'completed' ? 'bg-green-900 text-green-300' :
                        mod.status === 'inprogress' ? 'bg-amber-900 text-amber-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>{mod.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedProject.deployed_link && (
                <a href={selectedProject.deployed_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4" /> Live Demo
                </a>
              )}
              {selectedProject.team?.project?.github_link && (
                <a href={selectedProject.team.project.github_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                  <Github className="w-4 h-4" /> GitHub
                </a>
              )}
              {selectedProject.team?.project?.video_link && (
                <a href={selectedProject.team.project.video_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors">
                  ▶ Video
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
