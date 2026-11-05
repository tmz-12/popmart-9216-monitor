const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const transient=error=>error?.retryable===true;

// GET is safe to retry. Writes are reconciled by saveState, never blindly replayed.
export async function retryRead(read,{sleep=pause,delays=[2000,5000]}={}) {
  for(let attempt=0;;attempt++) {
    try {return await read();} catch(error) {
      if(!transient(error) || attempt>=delays.length) throw error;
      await sleep(delays[attempt]);
    }
  }
}

export async function saveState({api,state,file,sleep=pause,delays=[2000,5000]}) {
  const text=JSON.stringify(state,null,2);
  const content=Buffer.from(text).toString('base64');
  const expectedSha=file?.sha ?? null;
  let lastError;
  // Three write opportunities. Every attempt first reads current remote bytes.
  for(let attempt=0;attempt<=delays.length;attempt++) {
    if(attempt) await sleep(delays[attempt-1]);
    try {
      const remote=await api('/contents/monitor-state.json?ref=monitor-state');
      if(remote && Buffer.from(remote.content,'base64').toString('utf8')===text) return remote;
      if((remote?.sha ?? null)!==expectedSha) throw Error('STATE_CHANGED_EXTERNALLY');
      const saved=await api('/contents/monitor-state.json','PUT',{
        message:'Record real inventory observation',branch:'monitor-state',content,
        ...(remote?{sha:remote.sha}:{})
      });
      if(!saved?.content?.sha) throw Object.assign(Error('STATE_ACK_INVALID'),{retryable:true});
      return saved.content;
    } catch(error) {
      if(!transient(error) && error.status!==409) throw error;
      lastError=error;
    }
  }
  // Even the final failed response may have committed successfully.
  const remote=await api('/contents/monitor-state.json?ref=monitor-state');
  if(remote && Buffer.from(remote.content,'base64').toString('utf8')===text) return remote;
  throw lastError;
}
