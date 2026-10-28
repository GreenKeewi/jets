// Presentation derives from host-owned settings; guests never invent a roster.
export function lobbyMatch(state, mode='dogfight', missionId='dogfight') {
  const ids=state.role==='offline'?[]:['host',...state.peers.filter(p=>p.connected).map(p=>p.id)];
  const counts=[0,1].map(team=>ids.filter(id=>(state.teams?.[id]??0)===team).length);
  const coopTeam=ids.length&&counts.some(n=>n===ids.length)?(counts[0]?0:1):null;
  const coop=mode==='dogfight'&&missionId==='dogfight'&&coopTeam!==null;
  const requested=state.matchSettings?.teamSize;
  const teamSize=Math.max(Number.isInteger(requested)&&requested>=1&&requested<=3?requested:1,...counts);
  const enemies=state.matchSettings?.enemyTeamSize;
  const enemyTeamSize=Number.isInteger(enemies)&&enemies>=1&&enemies<=4?enemies:4;
  return{coop,coopTeam,counts,teamSize,enemyTeamSize,editable:state.role==='host'&&!state.teamsLocked};
}
