import test from 'node:test';
import assert from 'node:assert/strict';
import {lobbyMatch} from '../lobby-match.js';
import {rosterConfig} from '../controls.js';
import {createGame,configurePlayers,step} from '../sim.js';

const room=(extra={})=>({role:'host',teams:{host:0,p1:0},peers:[{id:'p1',connected:true}],teamsLocked:false,matchSettings:{teamSize:2,enemyTeamSize:4},...extra});

test('host and friend share a two-pilot squad against four airport-respawning AI',()=>{
  for(const team of [0,1]){
    const ids=['host','p1'],teams={host:team,p1:team};
    const config=rosterConfig({mode:'dogfight',teamSize:1,enemyTeamSize:4,enemyRespawnSeconds:30},ids,teams);
    assert.equal(config.teamSize,2);
    assert.deepEqual(config.teamSizes,team===0?[2,4]:[4,2]);
    const game=createGame(config);configurePlayers(game,ids,teams);
    assert.equal(game.pilots.filter(p=>p.human&&p.team===team).length,2);
    const enemies=game.pilots.filter(p=>p.team!==team);
    assert.equal(enemies.length,4);assert(enemies.every(p=>!p.human&&p.enemyRespawnEligible));
    const enemy=enemies[0];Object.assign(enemy,{pos:{x:30000,y:-100,z:30000},grounded:false,departureActive:false});
    step(game,{},1/60);assert.equal(enemy.dead,true);assert.equal(enemy.respawnAt,game.time+30);
    game.time=enemy.respawnAt;step(game,{},1/60);
    assert.equal(enemy.dead,false);assert.equal(enemy.grounded,true);assert.equal(enemy.team,1-team);
  }
});

test('asymmetric AI seats are explicit co-op settings; legacy PvP stays symmetric',()=>{
  for(const teamSize of [1,2,3]){
    const mixed=rosterConfig({mode:'dogfight',teamSize,enemyTeamSize:4,teamSizes:[4,4,4],enemyRespawnSeconds:30},['host','p1'],{host:0,p1:1});
    assert.equal(mixed.enemyTeamSize,undefined);assert.equal(mixed.teamSizes,undefined);assert.equal(mixed.coopTeam,undefined);assert.equal(mixed.enemyRespawnSeconds,0);
    assert.deepEqual(createGame(mixed).teamSizes,[teamSize,teamSize]);
    const legacy=rosterConfig({mode:'dogfight',teamSize},['host','p1'],{host:0,p1:0});
    assert.equal(legacy.enemyTeamSize,undefined);assert.equal(legacy.teamSizes,undefined);
  }
  for(const enemyTeamSize of [0,5,NaN,Infinity,'4',null])assert.equal(rosterConfig({mode:'dogfight',teamSize:2,enemyTeamSize},['host','p1'],{host:0,p1:0}).enemyTeamSize,undefined);
  for(const mode of ['strike','freeflight'])assert.equal(rosterConfig({mode,teamSize:2,enemyTeamSize:4},['host','p1'],{host:0,p1:0}).enemyTeamSize,undefined);
  const mission=rosterConfig({mode:'dogfight',missionId:'escort',teamSize:2,enemyTeamSize:4,enemyRespawnSeconds:30},['host','p1'],{host:0,p1:0});
  assert.equal(mission.enemyTeamSize,undefined);assert.equal(mission.enemyRespawnSeconds,0);
});

test('lobby counts include human capacity and guests display host settings without edit access',()=>{
  assert.deepEqual(lobbyMatch(room()),{coop:true,coopTeam:0,counts:[2,0],teamSize:2,enemyTeamSize:4,editable:true});
  const guest=lobbyMatch(room({role:'guest',localId:'p1',matchSettings:{teamSize:1,enemyTeamSize:3}}));
  assert.equal(guest.teamSize,2);assert.equal(guest.enemyTeamSize,3);assert.equal(guest.editable,false);
  assert.equal(lobbyMatch(room({teamsLocked:true})).editable,false);
  assert.equal(lobbyMatch(room({teams:{host:0,p1:1}})).coop,false);
  assert.equal(lobbyMatch(room(),'strike').coop,false);
  assert.equal(lobbyMatch(room(),'dogfight','escort').coop,false);
  assert.equal(lobbyMatch(room({peers:[{id:'p1',connected:false}]})).counts[0],1);
});
