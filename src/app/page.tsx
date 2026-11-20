'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

type Subject={id:string;name:string};
type Topic={id:string;subject_id:string;title:string};
type Note={id:string;topic_id:string;content:string};
type Evaluation={strengths:string[];gaps:string[];summary:string;followUpQuestion:string;matchScore:number;needsMoreContext:boolean};
type Attempt={id:string;topic_id:string;explanation_text:string;prior_attempt_id:string|null;created_at:string;status:string;evaluations?:{result:Evaluation;match_score:number}|null};
type QueueItem={topic_id:string;topic_title:string;subject_name:string;last_attempt_at:string|null;match_score:number|null;reason:string};
type Section='study'|'history'|'review';
const initialMessage='This is a working MVP study journey. AI feedback requires your configured OpenAI API key and a reachable database.';
export default function Home(){
  const [mode,setMode]=useState<'sign-in'|'sign-up'|'recover'>('sign-in');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [token,setToken]=useState<string|null>(null);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [topics,setTopics]=useState<Topic[]>([]);
  const [notes,setNotes]=useState<Note[]>([]);
  const [history,setHistory]=useState<Attempt[]>([]);
  const [review,setReview]=useState<QueueItem[]>([]);
  const [subjectId,setSubjectId]=useState('');const [topicId,setTopicId]=useState('');
  const [newSubject,setNewSubject]=useState('');const [newTopic,setNewTopic]=useState('');
  const [noteText,setNoteText]=useState('');const [explanation,setExplanation]=useState('');
  const [difficulty,setDifficulty]=useState<'beginner'|'intermediate'>('beginner');
  const [priorAttemptId,setPriorAttemptId]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<Evaluation|null>(null);
  const [section,setSection]=useState<Section>('study');
  const [message,setMessage]=useState(initialMessage);
  const [busy,setBusy]=useState(false);
  const requestKey=useRef<string|null>(null);

  const api=useCallback(async <T,>(path:string,method='GET',body?:object):Promise<T>=>{
    const response=await fetch(path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json().catch(()=>({error:'Invalid server response.'}));
    if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
    return data as T;
  },[token]);
  const refresh=useCallback(async()=>{
    const [s,t,n,a,q]=await Promise.all([
      api<Subject[]>('/api/materials/subjects'),api<Topic[]>('/api/materials/topics'),
      api<Note[]>('/api/materials/reference-notes'),api<Attempt[]>('/api/attempts'),
      api<QueueItem[]>('/api/review-queue')]);
    setSubjects(s);setTopics(t);setNotes(n);setHistory(a);setReview(q);
    setSubjectId(prev=>s.some(x=>x.id===prev)?prev:(s[0]?.id??''));
  },[api]);
  useEffect(()=>{if(token) refresh().catch(e=>setMessage(e.message));},[token,refresh]);
  useEffect(()=>{setTopicId(prev=>topics.some(t=>t.id===prev&&t.subject_id===subjectId)?prev:(topics.find(t=>t.subject_id===subjectId)?.id??''));},[subjectId,topics]);
  // Refreshing notes or history must not wipe the draft or feedback.
  useEffect(()=>{setNoteText(notes.find(n=>n.topic_id===topicId)?.content??'');},[topicId]);
  async function auth(e:FormEvent){
    e.preventDefault();setBusy(true);setMessage('Connecting to account service…');
    try{
      if(mode==='recover'){
        const data=await api<{message:string}>('/api/auth/recover','POST',{email});
        setMessage(data.message);return;
      }
      const data=await api<{session?:{access_token:string}|null}>('/api/auth/'+mode,'POST',{email,password});
      if(data.session?.access_token){setToken(data.session.access_token);setMessage('Signed in. Welcome to ExplainQuest.');}
      else {setMode('sign-in');setMessage('Account created. Check your email for a verification link, then sign in.');}
    }catch(err){setMessage((err as Error).message);}finally{setBusy(false);}
  }
  async function act(work:()=>Promise<void>,start='Saving…'){
    setBusy(true);setMessage(start);
    try{await work();setMessage('Saved successfully.');}
    catch(err){setMessage((err as Error).message);}finally{setBusy(false);}
  }
  function signOut(){setToken(null);setHistory([]);setSubjects([]);setTopics([]);setNotes([]);setReview([]);setFeedback(null);setMessage('Signed out.');}
  if(!token)return <main className="auth-shell">
    <section className="brand-panel"><p className="eyebrow">EXPLAINQUEST</p><h1>Learn it.<br/>Explain it.<br/><em>Master it.</em></h1><p>Turn what you study into explanations, revisions, and measurable progress.</p><div className="brand-detail">STUDY WITH PURPOSE · BUILD CONFIDENCE</div></section>
    <section className="auth-panel"><div className="form-card"><span className="step-label">WELCOME TO EXPLAINQUEST</span><h2>{mode==='sign-in'?'Sign in':mode==='sign-up'?'Create your account':'Reset your password'}</h2><p className="muted">{mode==='recover'?'We will send you a password-reset link.':'A clearer way to practice what you know.'}</p>
      <form onSubmit={auth} className="stack">
        <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="alex@example.edu"/></label>
        {mode!=='recover'&&<label>Password<input required minLength={mode==='sign-up'?12:1} maxLength={128} type="password" autoComplete={mode==='sign-up'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='sign-up'?'At least 12 characters':'Your password'}/></label>}
        <button className="primary" disabled={busy} type="submit">{busy?'Working…':mode==='sign-in'?'Sign in':mode==='sign-up'?'Create account':'Send reset link'}</button>
      </form>
      <div className="auth-links"><button type="button" className="text-button" onClick={()=>setMode(mode==='sign-up'?'sign-in':'sign-up')}>{mode==='sign-up'?'Back to sign in':'Create account'}</button><button type="button" className="text-button" onClick={()=>setMode(mode==='recover'?'sign-in':'recover')}>{mode==='recover'?'Back to sign in':'Forgot password?'}</button></div>
      <p role="status" className="notice">{message}</p></div></section>
  </main>;
  const activeTopic=topics.find(t=>t.id===topicId);
  const filteredTopics=topics.filter(t=>t.subject_id===subjectId);
  
  async function submit(){
    if(!topicId||!explanation.trim())throw Error('Choose a topic and write an explanation first.');
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    const result=await api<{attemptId:string;evaluation:Evaluation}>('/api/attempts','POST',{
      topicId,requestKey:requestKey.current,explanation,difficulty,priorAttemptId
    });
    setFeedback(result.evaluation);setPriorAttemptId(result.attemptId);requestKey.current=null;
    setMessage('Evaluation saved. Review the feedback and revise your explanation.');
    await refresh();
  }
  return <main className="app-shell"><aside className="sidebar"><div className="logo">✦ <strong>ExplainQuest</strong></div><div className="sidebar-caption">YOUR STUDY WORKSPACE</div>
    <nav aria-label="Study navigation">
      <button className={section==='study'?'active':''} onClick={()=>setSection('study')}>▤ &nbsp; Study workspace</button>
      <button className={section==='history'?'active':''} onClick={()=>setSection('history')}>◷ &nbsp; Attempt history</button>
      <button className={section==='review'?'active':''} onClick={()=>setSection('review')}>◈ &nbsp; Review queue</button>
    </nav><div className="sidebar-bottom"><p>{email}</p><button className="text-button" onClick={signOut}>Sign out</button></div></aside>
    <div className="main-content"><header className="topbar"><span>MY WORKSPACE / {section.toUpperCase()}</span><span className="small-pill">MVP DEVELOPMENT</span></header>
      <section className="headline"><span className="step-label">LEARN IT · EXPLAIN IT · MASTER IT</span><h1>{section==='study'?'Your learning starts here':section==='history'?'Your attempt history':'Time to review'}</h1><p>{section==='study'?'Build a topic, explain it in your own words, and improve using AI feedback.':section==='history'?'See what you submitted and how your understanding has evolved.':'Topics with unresolved gaps or no recent practice.'}</p></section>
      <p className="notice" role="status">{message}</p>
      {section==='study'&&<div className="workspace-grid"><div className="stack">
        <section className="panel"><div className="panel-heading"><span className="number">01</span><div><h2>Subjects & topics</h2><p>Organize what you want to study.</p></div></div>
          <label>Choose a subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setExplanation('');setFeedback(null);setPriorAttemptId(null);requestKey.current=null;}}><option value="">Select a subject</option>{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <div className="inline-form"><label>New subject<input maxLength={200} value={newSubject} onChange={e=>setNewSubject(e.target.value)} placeholder="Introduction to Programming"/></label><button disabled={busy||!newSubject.trim()} onClick={()=>act(async()=>{const s=await api<Subject>('/api/materials/subjects','POST',{name:newSubject});setNewSubject('');await refresh();setSubjectId(s.id);})}>Add</button></div>
          <label>Choose a topic<select value={topicId} onChange={e=>{setTopicId(e.target.value);setExplanation('');setFeedback(null);setPriorAttemptId(null);requestKey.current=null;}} disabled={!subjectId}><option value="">Select a topic</option>{filteredTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
          <div className="inline-form"><label>New topic<input maxLength={200} value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Loops" disabled={!subjectId}/></label><button disabled={busy||!subjectId||!newTopic.trim()} onClick={()=>act(async()=>{const t=await api<Topic>('/api/materials/topics','POST',{subjectId,title:newTopic});setNewTopic('');await refresh();setTopicId(t.id);})}>Add</button></div>
        </section>
        <section className="panel"><div className="panel-heading"><span className="number">02</span><div><h2>Reference notes</h2><p>Give the evaluation useful context.</p></div></div><label>Notes for {activeTopic?.title??'your topic'}<textarea rows={5} maxLength={50000} value={noteText} onChange={e=>setNoteText(e.target.value)} disabled={!topicId} placeholder="A while loop evaluates its condition before every iteration…"/></label><button className="secondary" disabled={busy||!topicId} onClick={()=>act(async()=>{await api('/api/materials/reference-notes','POST',{topicId,content:noteText});await refresh();})}>Save notes</button></section>
      </div><div className="stack"><section className="panel"><div className="panel-heading"><span className="number">03</span><div><h2>Explain a concept</h2><p>Teach it back in your own words.</p></div></div>
        <div className="topic-chip">TOPIC: {activeTopic?.title??'Choose a topic first'}</div>
        <label>Difficulty<select value={difficulty} onChange={e=>{setDifficulty(e.target.value as typeof difficulty);requestKey.current=null;}}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option></select></label>
        <label>Your explanation<textarea rows={7} maxLength={10000} disabled={!topicId} value={explanation} onChange={e=>{setExplanation(e.target.value);requestKey.current=null;}} placeholder="A loop repeats code while a condition is true…"/></label>
        <div className="field-footer"><span>{explanation.length} / 10,000 characters</span>{priorAttemptId&&<span>Revision of saved attempt</span>}</div>
        <button className="primary" disabled={busy||!topicId||!explanation.trim()} onClick={()=>act(submit,'Submitting explanation for AI feedback…')}>{busy?'Evaluating…':priorAttemptId?'Submit revision':'Evaluate explanation'}</button>
      </section>
      <section className="panel feedback-panel"><div className="panel-heading"><span className="number">04</span><div><h2>AI coach feedback</h2><p>Feedback is advisory, not a grade.</p></div></div>
        {feedback?<><div className="score-row"><strong>{feedback.matchScore}%</strong><span>Estimated concept coverage</span></div><p>{feedback.summary}</p>{feedback.needsMoreContext&&<p className="warn">More reference context is needed before relying on this score.</p>}
          <h3>Strengths</h3><ul>{feedback.strengths.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Areas to improve</h3>{feedback.gaps.length?<ul>{feedback.gaps.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>No gaps identified in this evaluation.</p>}
          <div className="follow-up"><strong>Try explaining:</strong><p>{feedback.followUpQuestion}</p></div>
        </>:<p className="muted">Submit an explanation to see concept coverage, strengths, gaps, and a follow-up question here.</p>}
      </section></div></div>}
      {section==='history'&&<section className="panel"><h2>Saved explanations</h2>{history.length===0?<p>No attempts yet. Start a study session to create your first explanation.</p>:<div className="item-list">{history.map(a=><article key={a.id} className="history-item"><div><strong>{topics.find(t=>t.id===a.topic_id)?.title??'Deleted topic'}</strong><span>{new Date(a.created_at).toLocaleString()} · {a.status}</span><p>{a.explanation_text}</p>{a.evaluations?.result&&<small>Coverage: {a.evaluations.match_score}% · {a.evaluations.result.summary}</small>}</div><button disabled={!topics.some(t=>t.id===a.topic_id)} onClick={()=>{setTopicId(a.topic_id);setSubjectId(topics.find(t=>t.id===a.topic_id)?.subject_id??'');setExplanation(a.explanation_text);setPriorAttemptId(a.id);setFeedback(a.evaluations?.result??null);setSection('study');requestKey.current=null;}}>Review / revise</button></article>)}</div>}</section>}
      {section==='review'&&<section className="panel"><div className="panel-heading"><span className="number">↻</span><div><h2>Smart review queue</h2><p>Unresolved gaps and topics not practiced for five days.</p></div></div>{review.length===0?<p>Nothing needs review yet. Keep practicing!</p>:<div className="item-list">{review.map(item=><article key={item.topic_id} className="history-item"><div><strong>{item.topic_title}</strong><span>{item.subject_name} · {item.reason==='unresolved_gap'?'Unresolved gap':'Not practiced recently'}</span><p>{item.match_score===null?'No evaluated score yet':`Last evaluated coverage: ${item.match_score}%`}</p></div><button onClick={()=>{setSubjectId(topics.find(t=>t.id===item.topic_id)?.subject_id??'');setTopicId(item.topic_id);setSection('study');}}>Practice</button></article>)}</div>}</section>}
      <footer className="app-footer">ExplainQuest · Student learning prototype · Scores are guidance, not course grades.</footer>
    </div></main>;
}
