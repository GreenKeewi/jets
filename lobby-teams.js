// Host/server authority: two teams, at most three human seats each.
export const TEAM_CAPACITY=3;
export const validTeam=team=>team===0||team===1;
export function validAssignments(value,ids){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(id=>ids.includes(id)&&validTeam(value[id]))&&[0,1].every(team=>Object.values(value).filter(t=>t===team).length<=TEAM_CAPACITY);
}
export function assignTeam(teams,ids,id,team){
 if(!ids.includes(id)||!validTeam(team))return false;
 if(ids.filter(q=>q!==id&&teams[q]===team).length>=TEAM_CAPACITY)return false;
 teams[id]=team;return true;
}
export function fillTeams(teams,ids){
 for(const id of Object.keys(teams))if(!ids.includes(id))delete teams[id];
 for(const id of ids)if(!validTeam(teams[id])){const count=t=>ids.filter(q=>teams[q]===t).length;teams[id]=count(0)<=count(1)?0:1;}
 return teams;
}
