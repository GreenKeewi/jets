// Deterministic transport fixture for session/queue edge cases. Not a native WebRTC test.
export class FixtureChannel {
  constructor(label, options = {}) {
    this.label=label;this.ordered=options.ordered??true;this.maxRetransmits=options.maxRetransmits??null;this.maxPacketLifeTime=null;
    this.readyState='connecting';this.bufferedAmount=0;this.sent=[];this.held=[];this.hold=false;this.failSends=0;
  }
  open(){this.readyState='open';this.onopen?.();}
  send(data){
    if(this.readyState!=='open')throw new DOMException('Not open','InvalidStateError');
    if(this.failSends>0){this.failSends--;throw new DOMException('Buffer full','OperationError');}
    this.sent.push(data);
    if(this.hold)this.held.push(data);else queueMicrotask(()=>this.peer?.onmessage?.({data}));
  }
  release(){for(const data of this.held.splice(0))queueMicrotask(()=>this.peer?.onmessage?.({data}));}
  low(){this.bufferedAmount=0;this.onbufferedamountlow?.();}
  close(){if(this.readyState==='closed')return;this.readyState='closed';this.onclose?.();this.peer?.close();}
}
const description=(type,id)=>({type,sdp:`v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=fixture-peer:${id}\r\na=candidate:1 1 UDP 1 127.0.0.1 12345 typ host\r\n`,toJSON(){return{type:this.type,sdp:this.sdp};}});
export class FixturePeer extends EventTarget {
  static all=[];
  constructor(configuration){super();this.id=FixturePeer.all.length;FixturePeer.all.push(this);this.configuration=configuration;this.channels=[];this.connectionState='new';this.signalingState='stable';this.iceGatheringState='new';}
  createDataChannel(label,options){const c=new FixtureChannel(label,options);this.channels.push(c);return c;}
  async createOffer(){return description('offer',this.id);}
  async createAnswer(){return description('answer',this.id);}
  async setLocalDescription(desc){this.localDescription=description(desc.type,this.id);this.signalingState=desc.type==='offer'?'have-local-offer':'stable';this.iceGatheringState='complete';this.dispatchEvent(new Event('icegatheringstatechange'));}
  async setRemoteDescription(desc){
    this.remoteDescription=desc;this.remote=FixturePeer.all[Number(desc.sdp.match(/a=fixture-peer:(\d+)/)?.[1])];
    this.signalingState=desc.type==='offer'?'have-remote-offer':'stable';
    if(desc.type==='answer'){
      for(const c of this.channels){const other=new FixtureChannel(c.label,{ordered:c.ordered,maxRetransmits:c.maxRetransmits});c.peer=other;other.peer=c;this.remote.channels.push(other);this.remote.ondatachannel?.({channel:other});}
      this.connectionState=this.remote.connectionState='connected';
      for(const c of this.channels){c.open();c.peer.open();}
      this.onconnectionstatechange?.();this.remote.onconnectionstatechange?.();
    }
  }
  getConfiguration(){return this.configuration;}
  close(){if(this.connectionState==='closed')return;this.connectionState='closed';for(const c of this.channels)c.close();this.onconnectionstatechange?.();this.dispatchEvent(new Event('connectionstatechange'));}
}
export const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
export async function pairFixture(host,guest){const offer=await host.createOffer(),answer=await guest.acceptOffer(offer);await host.acceptAnswer(answer);await settle();return{host:FixturePeer.all.at(-2),guest:FixturePeer.all.at(-1)};}
