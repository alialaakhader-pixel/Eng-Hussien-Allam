import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  ThumbsUp, 
  Award, 
  CheckCircle2, 
  Send, 
  Filter, 
  Sparkles, 
  Atom, 
  HelpCircle,
  User,
  X
} from 'lucide-react';
import { ForumPost, ForumAnswer, StudentUser, GradeType } from '../types';

interface ForumViewProps {
  posts: ForumPost[];
  onAddPost: (post: ForumPost) => void;
  onAddAnswer: (postId: string, answer: ForumAnswer) => void;
  onUpvotePost: (postId: string) => void;
  currentStudent: StudentUser | null;
  isTeacherAuth: boolean;
  onOpenLoginModal: () => void;
}

const CATEGORIES = [
  'الكل',
  'التيار الكهربي وقانون أوم',
  'الحث الكهرومغناطيسي',
  'التأثير المغناطيسي للتيار والكهرباء المتحركة',
  'الفيزياء الحديثة',
  'أسئلة الامتحانات العامة'
];

export const ForumView: React.FC<ForumViewProps> = ({
  posts,
  onAddPost,
  onAddAnswer,
  onUpvotePost,
  currentStudent,
  isTeacherAuth,
  onOpenLoginModal
}) => {
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePostId, setActivePostId] = useState<string | null>(posts[0]?.id || null);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  // New question form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('التيار الكهربي وقانون أوم');
  const [newGrade, setNewGrade] = useState<GradeType>('3ث');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState(currentStudent?.name || '');

  // New answer input state
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchCategory = selectedCategory === 'الكل' || post.category === selectedCategory;
    const matchSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const activePost = posts.find(p => p.id === activePostId) || filteredPosts[0];

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('يرجى كتابة عنوان وسؤال واضح');
      return;
    }

    const post: ForumPost = {
      id: 'forum-' + Date.now(),
      title: newTitle.trim(),
      content: newContent.trim(),
      authorName: currentStudent ? currentStudent.name : (newAuthor.trim() || 'طالب متميز'),
      authorRole: isTeacherAuth ? 'teacher' : 'student',
      grade: newGrade,
      category: newCategory,
      createdAt: 'الآن',
      upvotes: 1,
      answers: []
    };

    onAddPost(post);
    setIsAskingQuestion(false);
    setActivePostId(post.id);
    setNewTitle('');
    setNewContent('');
  };

  const handlePostAnswer = (postId: string) => {
    const text = answerInputs[postId];
    if (!text || !text.trim()) return;

    const answer: ForumAnswer = {
      id: 'ans-' + Date.now(),
      authorName: isTeacherAuth ? 'المهندس حسين علام' : (currentStudent ? currentStudent.name : 'طالب فيزياء'),
      authorRole: isTeacherAuth ? 'teacher' : 'student',
      isTeacherVerified: isTeacherAuth,
      content: text.trim(),
      createdAt: 'الآن',
      upvotes: 0
    };

    onAddAnswer(postId, answer);
    setAnswerInputs({ ...answerInputs, [postId]: '' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Top Forum Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 text-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/30">
                منتدى فيزياء المهندس حسين علام 💬
              </span>
              <span className="text-xs text-slate-400">
                إجابات ونقاشات نموذجية معتمدة
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
              مجتمع وناقشات فيزياء الثانوية العامة
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              مكانك المفتوح لطرح أي مسألة أو فكرة وقفت أمامك، تبادل الأفكار مع زملائك، والحصول على إجابة وشرح معتمد من المهندس حسين علام.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAskingQuestion(true)}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>اطرح سؤالاً في الفيزياء</span>
            </button>
          </div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 text-xs font-bold select-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Forum Content: Question List on Right, Active Question Details on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Posts List (Right side) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث في الأسئلة أو القوانين..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
            {filteredPosts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                لا توجد أسئلة في هذا القسم بعد. كن أول من يطرح سؤالاً!
              </div>
            ) : (
              filteredPosts.map(post => {
                const isSelected = activePost?.id === post.id;
                const hasTeacherVerified = post.answers.some(a => a.isTeacherVerified);

                return (
                  <div
                    key={post.id}
                    onClick={() => setActivePostId(post.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500/70 shadow-lg'
                        : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-bold">
                        {post.category}
                      </span>
                      {hasTeacherVerified && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          <span>إجابة المدرس</span>
                        </span>
                      )}
                    </div>

                    <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                      {post.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <span>{post.authorName} ({post.grade})</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-mono">
                          <ThumbsUp className="w-3 h-3 text-amber-500" /> {post.upvotes}
                        </span>
                        <span>{post.answers.length} ردود</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Post Details & Replies (Left side) */}
        <div className="lg:col-span-7">
          {activePost ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-white space-y-6">
              
              {/* Question Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs">
                      {activePost.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activePost.grade} · {activePost.createdAt}
                    </span>
                  </div>

                  <button
                    onClick={() => onUpvotePost(activePost.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-mono">{activePost.upvotes}</span>
                  </button>
                </div>

                <h2 className="text-xl font-display font-black leading-snug text-white">
                  {activePost.title}
                </h2>

                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                    {activePost.authorName.charAt(0)}
                  </div>
                  <span>طرح السؤال بواسطة: <strong className="text-slate-200">{activePost.authorName}</strong></span>
                </div>

                <div className="mt-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {activePost.content}
                </div>
              </div>

              {/* Answers Section */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>الإجابات والحلول ({activePost.answers.length})</span>
                  </h3>
                </div>

                {activePost.answers.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500">
                    لا توجد إجابات على هذا السؤال بعد. كن أول من يجيب!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activePost.answers.map(ans => (
                      <div
                        key={ans.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition ${
                          ans.isTeacherVerified
                            ? 'bg-gradient-to-br from-amber-500/10 via-slate-800/80 to-slate-900 border-amber-500/50 shadow-md shadow-amber-500/5'
                            : 'bg-slate-800/40 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            {ans.isTeacherVerified ? (
                              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-sm">
                                علام
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs">
                                {ans.authorName.charAt(0)}
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${ans.isTeacherVerified ? 'text-amber-300 font-display font-black text-sm' : 'text-white'}`}>
                                  {ans.authorName}
                                </span>
                                {ans.isTeacherVerified && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center gap-1">
                                    <Award className="w-3 h-3 text-amber-400" />
                                    إجابة معتمدة
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">{ans.createdAt}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line mt-2">
                          {ans.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Answer Box */}
                <div className="pt-4 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    {isTeacherAuth ? 'أضف إجابة معتمدة كمهندس حسين علام:' : 'شارك بإجابتك أو حلك للمسألة:'}
                  </label>
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={answerInputs[activePost.id] || ''}
                      onChange={e => setAnswerInputs({ ...answerInputs, [activePost.id]: e.target.value })}
                      placeholder={isTeacherAuth ? 'اكتب الشرح المعتمد والخطوات الصحيحة...' : 'اكتب حلك للمسألة وملاحظاتك...'}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition leading-relaxed"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {isTeacherAuth ? '⭐ سيتم وسم الإجابة بختم المدرس' : (currentStudent ? `تكتب باسم: ${currentStudent.name}` : 'طالب فيزياء')}
                      </span>
                      <button
                        onClick={() => handlePostAnswer(activePost.id)}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الإجابة</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-sm">
              اختر سؤالاً من القائمة لعرض تفاصيله وإجاباته
            </div>
          )}
        </div>

      </div>

      {/* Ask Question Modal */}
      {isAskingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white">
            
            <button
              onClick={() => setIsAskingQuestion(false)}
              className="absolute top-5 left-5 w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-display font-black text-white">
                  طرح سؤال فيزيائي جديد
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  اطرح مسألتك ليجيبك المهندس حسين علام وزملاؤك
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">عنوان السؤال أو المسألة *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="مثال: كيف أحدد إشارة القوة الدافعة الكهربية في قانون فاراداي؟"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">القسم الفيزيائي</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="التيار الكهربي وقانون أوم">التيار الكهربي وقانون أوم</option>
                    <option value="الحث الكهرومغناطيسي">الحث الكهرومغناطيسي</option>
                    <option value="التأثير المغناطيسي للتيار والكهرباء المتحركة">التأثير المغناطيسي</option>
                    <option value="الفيزياء الحديثة">الفيزياء الحديثة</option>
                    <option value="أسئلة الامتحانات العامة">أسئلة الامتحانات العامة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف</label>
                  <select
                    value={newGrade}
                    onChange={e => setNewGrade(e.target.value as GradeType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="3ث">تالتة ثانوي</option>
                    <option value="2ث">تانية ثانوي</option>
                    <option value="1ث">أولى ثانوي</option>
                    <option value="بكالوريا">بكالوريا</option>
                  </select>
                </div>
              </div>

              {!currentStudent && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسمك (طالب)</label>
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    placeholder="اكتب اسمك..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">تفاصيل المسألة أو السؤال *</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="اكتب نص المسألة والمعطيات والنقطة التي وقفت معك..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-sm shadow-lg shadow-amber-500/25 transition"
              >
                نشر السؤال في المنتدى 🚀
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
