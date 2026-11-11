'use strict';

window.KaoruSenses = (() => {
  const gaussian = (x, y, cx, cy, sx, sy) =>
    Math.exp(-(((x-cx)/sx)**2 + ((y-cy)/sy)**2));
  const ribbon = (points, width) => {
    const segments = points.slice(1).map(([x2,y2],i) => {
      const [x,y] = points[i];
      return [x,y,x2-x,y2-y,(x2-x)**2+(y2-y)**2];
    });
    return (x,y) => {
      let distance = Infinity;
      for (const [sx,sy,dx,dy,length] of segments) {
        const t = Math.max(0,Math.min(1,((x-sx)*dx+(y-sy)*dy)/length));
        distance = Math.min(distance,(x-sx-t*dx)**2+(y-sy-t*dy)**2);
      }
      return Math.exp(-distance/(width*width));
    };
  };
  const arc = (start,end,steps,fn) => Array.from({length:steps+1},(_,i) => fn(start+(end-start)*i/steps));
  const eyeUpper = ribbon(arc(-.72,.72,18,x=>[x,.27*(1-(x/.72)**2)+.06*x]),.063);
  const eyeLower = ribbon(arc(-.72,.72,18,x=>[x,-.19*(1-(x/.72)**2)+.06*x]),.056);
  const eyeBrow = ribbon([[-.74,.37],[-.48,.49],[-.14,.54],[.22,.5],[.58,.38]],.085);
  const earRim = ribbon([[-.41,-.16],[-.51,.08],[-.46,.36],[-.30,.58],[-.03,.65],[.26,.61],[.45,.44],[.49,.19],[.42,-.07],[.26,-.28],[.11,-.49],[-.11,-.59],[-.31,-.54],[-.36,-.42]],.135);
  const earFold = ribbon([[-.23,-.31],[.03,-.27],[.19,-.05],[.20,.15],[.10,.34],[-.07,.40]],.106);
  const earFork = ribbon([[.18,.15],[.03,.20],[-.16,.16],[-.27,.04]],.075);
  const noseBridge = ribbon([[0,.60],[-.028,.37],[-.05,.12],[-.034,-.16]],.21);
  const lipTop = ribbon([[-.72,-.036],[-.49,.05],[-.28,.16],[-.14,.19],[0,.12],[.16,.20],[.30,.15],[.49,.048],[.72,-.036]],.119);
  const lipBottom = ribbon([[-.72,-.04],[-.46,-.14],[-.22,-.22],[0,-.24],[.24,-.21],[.49,-.13],[.72,-.04]],.14);
  const lipSeam = ribbon([[-.72,-.039],[-.39,-.049],[-.15,-.034],[0,-.072],[.18,-.039],[.43,-.057],[.72,-.039]],.028);
  const fingers = [
    ribbon([[-.34,-.11],[-.56,.06],[-.69,.22]],.104),
    ribbon([[-.28,.16],[-.31,.43],[-.31,.64]],.087),
    ribbon([[-.084,.16],[-.08,.45],[-.05,.73]],.089),
    ribbon([[.105,.13],[.17,.39],[.20,.63]],.08),
    ribbon([[.25,.06],[.35,.24],[.40,.43]],.073)
  ];
  const palmLine = ribbon([[-.26,.08],[-.11,-.04],[.08,-.17],[.22,-.19]],.037);
  const thumbLine = ribbon([[-.30,.07],[-.35,-.12],[-.26,-.28],[-.13,-.37]],.03);

  const forms = {
    eyes(x,y) {
      const iris = Math.hypot(x+.038,y-.016);
      const almond = Math.max(0,1-(x/.72)**2-(y/.285)**2);
      return .20*almond + .23*eyeUpper(x,y) + .16*eyeLower(x,y) +
        .12*eyeBrow(x,y) + .10*Math.exp(-(((iris-.149)/.034)**2)) -
        .086*gaussian(x,y,-.038,.016,.067,.067) + .08*gaussian(x,y,0,.03,.83,.5);
    },
    ears(x,y) {
      return .40*earRim(x,y) + .25*earFold(x,y) + .115*earFork(x,y) +
        .19*gaussian(x,y,-.22,-.46,.20,.17) + .16*gaussian(x,y,-.37,-.13,.13,.16) +
        .12*gaussian(x,y,0,.1,.56,.68) - .12*gaussian(x,y,-.15,-.06,.17,.20);
    },
    nose(x,y) {
      return .30*noseBridge(x,y) + .44*gaussian(x,y,-.02,-.18,.25,.22) +
        .29*(gaussian(x,y,-.27,-.25,.18,.13)+gaussian(x,y,.25,-.25,.18,.13)) +
        .13*gaussian(x,y,0,-.37,.09,.14) - .17*(gaussian(x,y,-.22,-.32,.09,.059)+gaussian(x,y,.20,-.32,.09,.059));
    },
    lips(x,y) {
      return .33*lipTop(x,y) + .35*lipBottom(x,y) - .19*lipSeam(x,y) +
        .075*gaussian(x,y,0,.28,.17,.17);
    },
    hand(x,y) {
      const palm=.34*gaussian(x,y,-.08,-.20,.32,.37) + .20*gaussian(x,y,-.10,-.55,.235,.27);
      const digits=.265*Math.max(...fingers.map(finger=>finger(x,y)));
      return palm + digits - .085*palmLine(x,y) - .072*thumbLine(x,y);
    }
  };

  function clayHeight(x,y,form) {
    const texture = .009*Math.sin(28*x+12*y)*Math.cos(19*y-4*x) +
      .005*Math.sin(62*x-12*y)*Math.sin(49*y+7*x) + .014*Math.sin(7*x-5*y)*Math.sin(8*y+2*x);
    return .1 + texture + form(x,y);
  }
  function makeMesh(form) {
    const n=60, row=n+1, count=row*row, vertices=[], indices=[];
    const front=[];
    for (let j=0;j<=n;j++) for (let i=0;i<=n;i++) {
      const u=2*i/n-1, v=2*j/n-1;
      const x=1.06*u*(1-.12*Math.abs(v)**10)+.016*Math.sin(5*v+u);
      const y=.84*v*(1-.14*Math.abs(u)**10)+.014*Math.cos(6*u-v);
      const bevel=.10*Math.exp(-13*(1-Math.max(Math.abs(u),Math.abs(v))));
      front.push([x,y,clayHeight(x,y,form)-bevel]);
    }
    for (let j=0;j<=n;j++) for (let i=0;i<=n;i++) {
      const p=front[j*row+i];
      const l=front[j*row+Math.max(0,i-1)], r=front[j*row+Math.min(n,i+1)];
      const b=front[Math.max(0,j-1)*row+i], t=front[Math.min(n,j+1)*row+i];
      vertices.push(...p,-(r[2]-l[2])/Math.max(.001,r[0]-l[0]),-(t[2]-b[2])/Math.max(.001,t[1]-b[1]),1);
    }
    for (const [x,y] of front) vertices.push(x,y,-.23+.009*Math.sin(x*19+y*14),0,0,-1);
    for (let j=0;j<n;j++) for (let i=0;i<n;i++) {
      const a=j*row+i,b=a+1,c=a+row,d=c+1;
      indices.push(a,b,c,b,d,c,a+count,c+count,b+count,b+count,c+count,d+count);
    }
    const edges=[
      Array.from({length:row},(_,i)=>i),
      Array.from({length:row},(_,i)=>i*row+n),
      Array.from({length:row},(_,i)=>n*row+n-i),
      Array.from({length:row},(_,i)=>(n-i)*row)
    ];
    for (const edge of edges) {
      for (let i=0;i<n;i++) {
        const a=front[edge[i]], b=front[edge[i+1]];
        const nx=b[1]-a[1],ny=a[0]-b[0],s=vertices.length/6;
        const len=Math.hypot(nx,ny);
        for (const p of [a,b]) vertices.push(...p,nx/len,ny/len,.12);
        for (const [x,y] of [a,b]) vertices.push(x,y,-.23+.009*Math.sin(x*19+y*14),nx/len,ny/len,-.1);
        indices.push(s,s+2,s+1,s+1,s+2,s+3);
      }
    }
    return [new Float32Array(vertices),new Uint16Array(indices)];
  }

  // Closed clay objects share the same lighting and surface grain as the senses.
  function objectMesh(key) {
    const vertices=[], indices=[];
    const surface=(fn,nu=48,nv=20) => {
      const base=vertices.length/6;
      for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) {
        const u=i/nu,v=j/nv,p=fn(u,v),a=fn(u+.0001,v),b=fn(u,v+.0001);
        const x=a.map((n,k)=>n-p[k]),y=b.map((n,k)=>n-p[k]);
        const n=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
        const length=Math.hypot(...n)||1;
        vertices.push(...p,...n.map(q=>q/length));
      }
      for(let j=0;j<nv;j++) for(let i=0;i<nu;i++) {
        const a=base+j*(nu+1)+i,b=a+1,c=a+nu+1;
        indices.push(a,b,c,b,c+1,c);
      }
    };
    const pebble=(cx,cy,cz,rx,ry,rz,power=1) => surface((u,v)=>{
      const a=u*Math.PI*2,b=v*Math.PI;
      const soft=n=>Math.sign(n)*Math.abs(n)**power;
      return [cx+rx*soft(Math.sin(b)*Math.cos(a)),cy+ry*soft(Math.cos(b)),cz+rz*soft(Math.sin(b)*Math.sin(a))];
    },32,16);
    const tube=(path,radius) => surface((u,v)=>{
      const p=path(u),q=path(u+.0001),t=q.map((n,i)=>n-p[i]),l=Math.hypot(...t)||1;
      const tangent=t.map(n=>n/l),a=[tangent[2],0,-tangent[0]],al=Math.hypot(...a)||1;
      const n=a.map(x=>x/al),b=[tangent[1]*n[2],tangent[2]*n[0]-tangent[0]*n[2],-tangent[1]*n[0]];
      return p.map((x,i)=>x+radius*(Math.cos(v*Math.PI*2)*n[i]+Math.sin(v*Math.PI*2)*b[i]));
    },64,12);
    if(key==='citrus') {
      surface((u,v)=>{const a=u*Math.PI*3.7,r=.55+.11*Math.sin(u*Math.PI);return [r*Math.cos(a),-.72+1.44*u+.13*Math.cos(v*2*Math.PI),r*Math.sin(a)+.045*Math.sin(v*2*Math.PI)];},72,12);
    } else if(key==='pavement') {
      pebble(0,-.25,0,.85,.22,.65,.45);
      for(const [x,y,z,r] of [[-.35,.22,.12,.18],[.35,.38,-.12,.14],[.02,.65,.05,.11]]) pebble(x,y,z,r,r*1.45,r);
    } else if(key==='flower') {
      tube(u=>[.08*Math.sin(u*4),-.85+1.5*u,0],.055);
      for(let i=0;i<6;i++) {const a=i*Math.PI/3;pebble(Math.cos(a)*.3,.45+Math.sin(a)*.3,.03,.22,.25,.10);}
      pebble(0,.45,.13,.16,.16,.12);
      pebble(-.25,-.25,0,.27,.11,.08);
    } else if(key==='fabric') {
      surface((u,v)=>{const a=v*2*Math.PI;return [(u-.5)*1.7,Math.cos(a)*.58,Math.sin(u*10+Math.cos(a)*2)*.16+.04*Math.sin(a)];});
    } else if(key==='sweet') {
      pebble(0,0,0,.62,.58,.55,.4);
    } else if(key==='leaf') {
      surface((u,v)=>{const a=v*2*Math.PI,w=Math.sin(u*Math.PI)*.46;return [w*Math.cos(a),u*1.7-.85,.15*Math.sin(u*4)+.06*Math.sin(a)*Math.sin(u*Math.PI)];});
      tube(u=>[0,u*1.7-.85,.15*Math.sin(u*4)+.055],.025);
    } else if(key==='cup') {
      surface((u,v)=>{const a=u*Math.PI*2,r=.48+.07*v;return [r*Math.cos(a),-.48+v*.9,r*Math.sin(a)];});
      tube(u=>[.55*Math.cos(u*Math.PI*2),.42,.55*Math.sin(u*Math.PI*2)],.045);
      tube(u=>[.48+.35*Math.sin(u*Math.PI),.32-.68*u,0],.085);
      pebble(0,-.48,0,.48,.045,.48);
    } else if(key==='book') {
      pebble(0,0,0,.64,.82,.16,.2);
      for(const z of [-.19,.19]) pebble(0,0,z,.69,.86,.035,.2);
      pebble(-.65,0,0,.06,.85,.20,.3);
    } else if(key==='apple') {
      pebble(-.17,-.08,0,.48,.56,.52);
      pebble(.17,-.08,0,.48,.56,.52);
      tube(u=>[.06*u,.40+.30*u,0],.045);
      pebble(.22,.57,0,.22,.08,.08);
    } else if(key==='candle') {
      pebble(0,-.13,0,.38,.58,.38,.35);
      tube(u=>[0,.43+.17*u,0],.025);
      pebble(0,.70,0,.10,.18,.08);
    } else if(key==='typewriter') {
      pebble(0,-.45,0,.88,.24,.55,.25);
      pebble(0,-.08,-.22,.78,.30,.26,.3);
      pebble(0,.20,-.13,.88,.085,.10,.3);
      pebble(0,.61,-.25,.56,.43,.035,.2);
      for(let j=0;j<4;j++) for(let i=0;i<10;i++) pebble((i-4.5)*.145,-.28-j*.10,.57,.052,.042,.045);
      pebble(0,-.65,.56,.40,.025,.045,.3);
    } else if(key==='folder') {
      pebble(0,0,0,.88,.62,.14,.2);
      pebble(-.46,.62,-.04,.32,.12,.10,.25);
      surface((u,v)=>{const a=v*2*Math.PI,x=(u-.5)*1.65;return [x,.48-(.70*(1-Math.abs(x/.83)))*(.5+.5*Math.cos(a)),.17+.045*Math.sin(a)];});
      for(const side of [-1,1]) tube(u=>{const a=u*Math.PI*4,r=.14*(1-u);return [side*.62+Math.cos(a)*r,-.40+Math.sin(a)*r,.17];},.018);
    } else {
      tube(u=>[.42*Math.sin(u*7),u*1.7-.85,.23*Math.cos(u*7)],.105);
    }
    return [new Float32Array(vertices),new Uint16Array(indices)];
  }

  function createRenderer() {
    const surface=document.createElement('canvas');
    const gl=surface.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
    if (!gl) return null;
    const shader = (type,source) => {
      const value=gl.createShader(type);
      gl.shaderSource(value,source);
      gl.compileShader(value);
      return value;
    };
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec3 position, normal;
      uniform vec2 angles, scale;
      varying vec3 clayPoint, clayNormal, localNormal;
      vec3 rotate(vec3 p) {
        float cy=cos(angles.x), sy=sin(angles.x), cx=cos(angles.y), sx=sin(angles.y);
        vec3 q=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);
        return vec3(q.x,q.y*cx-q.z*sx,q.y*sx+q.z*cx);
      }
      void main() {
        vec3 p=rotate(position);
        clayPoint=position;
        localNormal=normal;
        clayNormal=normalize(rotate(normal));
        gl_Position=vec4(p.xy*scale,-p.z*.42,1.0-p.z*.18);
      }
    `));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float;
      uniform vec3 pigment;
      uniform float material;
      varying vec3 clayPoint, clayNormal, localNormal;
      float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*4375.8545);}
      void main(){
        vec2 p=clayPoint.xy+vec2(clayPoint.z*.37,clayPoint.z*.69);
        float fleck=grain(floor(p*163.0));
        float pit=step(.977,grain(floor(p*83.0)));
        float striation=sin(p.x*139.0+p.y*31.0+sin(p.y*23.0)*3.0);
        vec3 n=normalize(clayNormal+vec3((fleck-.5)*.09,striation*.027,0.0));
        float light=max(0.0,dot(n,normalize(vec3(-.48,.61,.69))));
        float bounce=max(0.0,dot(n,normalize(vec3(.7,-.4,.3))));
        float matte=.43+.55*light+.10*bounce;
        float surface=(fleck-.5)*.066+striation*.014-pit*.062;
        vec3 color=pigment;
        float sheen=0.0;
        if(material==1.0){
          float inside=step(dot(normalize(localNormal),normalize(vec3(clayPoint.x,0.,clayPoint.z))),-.12);
          float pores=grain(floor(clayPoint.xy*105.0+clayPoint.z*33.0));
          color=mix(pigment,vec3(.94,.84,.62),inside);
          color+=vec3(.07,.028,-.01)*sin(clayPoint.y*15.0+clayPoint.x*8.0);
          surface=(pores-.5)*.09-step(.91,pores)*.06;
        } else if(material==2.0){
          if(clayPoint.y>0.0){
            color=vec3(.48,.65,.73);
            sheen=pow(max(0.,dot(n,normalize(vec3(-.35,.55,1.)))),28.)*.44;
            surface*=.12;
          } else {
            float aggregate=grain(floor(p*45.0));
            color+=vec3((aggregate-.5)*.18);
            float crack=1.-smoothstep(.015,.04,abs(sin(p.x*17.+sin(p.y*8.)*2.)));
            surface-=crack*.065;
            sheen=pow(max(0.,dot(n,normalize(vec3(-.35,.55,1.)))),18.)*.13;
          }
        } else if(material==3.0){
          surface+=sin(p.x*220.)*sin(p.y*220.)*.025;
        }
        gl_FragColor=vec4(color*matte+surface+sheen,1.0);
      }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0,0,0,0);
    const position=gl.getAttribLocation(program,'position'),normal=gl.getAttribLocation(program,'normal');
    const angles=gl.getUniformLocation(program,'angles'),scale=gl.getUniformLocation(program,'scale');
    const pigment=gl.getUniformLocation(program,'pigment'),material=gl.getUniformLocation(program,'material');
    const finishes={cup:[[.48,.65,.70],0],book:[[.43,.52,.66],0],apple:[[.73,.30,.23],0],candle:[[.91,.77,.52],0],citrus:[[.95,.45,.095],1],pavement:[[.32,.35,.37],2],flower:[[.66,.54,.72],0],leaf:[[.43,.56,.36],0],fabric:[[.80,.75,.64],3],sweet:[[.76,.51,.30],0],wisp:[[.63,.69,.71],0]};
    const meshes=new Map();
    return (key, width, height, yaw, pitch) => {
      if (!meshes.has(key)) {
        const [points,indices]=forms[key] ? makeMesh(forms[key]) : objectMesh(key);
        const data=gl.createBuffer(), index=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,data);
        gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
        meshes.set(key,{data,index,count:indices.length});
      }
      if (surface.width < width) surface.width=width;
      if (surface.height < height) surface.height=height;
      const mesh=meshes.get(key), ratio=width/height;
      gl.viewport(0,0,width,height);
      gl.scissor(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.data);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);
      gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(normal);
      gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);
      gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);
      const [color,kind]=finishes[key] || [[.67,.655,.615],0];
      gl.uniform3fv(pigment,color);gl.uniform1f(material,kind);
      gl.uniform2f(angles,yaw,pitch);
      gl.uniform2f(scale,Math.min(.78,1.02/ratio),Math.min(1.02,.78*ratio));
      gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
      return surface;
    };
  }

  const poses=new WeakMap();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
  const turns={
    eyes:{yaw:-.38,rate:.155},
    ears:{yaw:.40,rate:-.11},
    hand:{yaw:-.65,rate:.25},
    nose:{yaw:-.45,rate:-.19},
    lips:{yaw:.55,rate:.125}
  };
  let renderModel;
  let activeFace, activeCanvases=[];
  let animationFrame=0, lastFrame=0;
  let drag, draggedTile;
  function draw(canvas) {
    if (!renderModel || !canvas.isConnected) return;
    const scale=Math.min(2,window.devicePixelRatio||1,520/canvas.clientWidth,360/canvas.clientHeight);
    const width=Math.round(canvas.clientWidth*scale),height=Math.round(canvas.clientHeight*scale);
    if (!width || !height) return;
    const pose=poses.get(canvas);
    const image=renderModel(canvas.dataset.senseModel,width,height,pose.yaw,pose.pitch);
    if (canvas.width!==width || canvas.height!==height) { canvas.width=width;canvas.height=height; }
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(image,0,image.height-height,width,height,0,0,width,height);
  }
  function canAnimate() {
    return activeFace?.isConnected && !activeFace.inert && !document.hidden && !reducedMotion.matches;
  }
  function animate(time) {
    animationFrame=0;
    if (!canAnimate()) { lastFrame=0; return; }
    if (!lastFrame || time-lastFrame>=31) {
      const elapsed=lastFrame ? Math.min(.08,(time-lastFrame)/1000) : 0;
      lastFrame=time;
      for (const canvas of activeCanvases) {
        const tile=canvas.parentElement;
        if (drag?.canvas===canvas || tile.matches(':focus-visible') || (finePointer.matches && tile.matches(':hover'))) continue;
        const pose=poses.get(canvas);
        const back=Math.max(0,-Math.cos(pose.yaw));
        pose.yaw+=elapsed*(turns[canvas.dataset.senseModel]?.rate || .18)*(1+back*1.5);
        draw(canvas);
      }
    }
    animationFrame=requestAnimationFrame(animate);
  }
  function syncAnimation() {
    if (canAnimate()) {
      if (!animationFrame) animationFrame=requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationFrame);
      animationFrame=0;
      lastFrame=0;
    }
  }
  function mount(face) {
    face = face.closest('.home-face') || face;
    if (renderModel === undefined) renderModel=createRenderer();
    if (!renderModel) { face.classList.add('no-sense-models'); return; }
    activeFace=face;
    activeCanvases=[...face.querySelectorAll('.sense-model')];
    for (const canvas of activeCanvases) {
      if (!poses.has(canvas)) poses.set(canvas,{yaw:(turns[canvas.dataset.senseModel]?.yaw || -.3),pitch:-.07});
      draw(canvas);
    }
    syncAnimation();
  }
  document.addEventListener('visibilitychange',syncAnimation);
  reducedMotion.addEventListener('change',syncAnimation);
  window.addEventListener('resize',() => {
    if (activeFace?.isConnected && !activeFace.inert) activeCanvases.forEach(draw);
  });
  document.addEventListener('pointerdown',event => {
    const canvas=event.target.closest('.sense-model');
    draggedTile=null;
    if (!canvas || !poses.has(canvas) || event.button!==0) return;
    canvas.classList.add('is-grabbed');
    drag={canvas,pointer:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0,moved:false};
  });
  document.addEventListener('pointermove',event => {
    if (!drag || event.pointerId!==drag.pointer) return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<4) return;
    if (!drag.moved) { drag.canvas.setPointerCapture(event.pointerId); drag.moved=true; }
    const pose=poses.get(drag.canvas);
    pose.yaw+=(dx-drag.dx)*.014;
    pose.pitch=Math.max(-1.15,Math.min(1.15,pose.pitch+(dy-drag.dy)*.011));
    drag.dx=dx;drag.dy=dy;
    draw(drag.canvas);
  });
  document.addEventListener('pointerup',event => {
    if (drag?.pointer!==event.pointerId) return;
    if (drag.moved) draggedTile=drag.canvas.closest('.sense-tile');
    drag.canvas.classList.remove('is-grabbed');
    drag=null;
  });
  document.addEventListener('pointercancel',event => {
    if (drag?.pointer!==event.pointerId) return;
    drag.canvas.classList.remove('is-grabbed');
    drag=null;draggedTile=null;
  });
  document.addEventListener('click',event => {
    if (!draggedTile || !event.detail || !draggedTile.contains(event.target)) return;
    draggedTile=null;
    event.preventDefault();event.stopPropagation();
  },true);
  document.addEventListener('keydown',event => {
    const canvas=event.target.closest('.sense-tile')?.querySelector('.sense-model');
    if (!event.shiftKey || !canvas || !poses.has(canvas) || !event.key.startsWith('Arrow')) return;
    const pose=poses.get(canvas);
    if (event.key==='ArrowLeft' || event.key==='ArrowRight') pose.yaw+=event.key==='ArrowLeft' ? -.22 : .22;
    else pose.pitch=Math.max(-1.15,Math.min(1.15,pose.pitch+(event.key==='ArrowUp' ? -.17 : .17)));
    event.preventDefault();event.stopPropagation();draw(canvas);
  },true);
  return {mount};
})();
