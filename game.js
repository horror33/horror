// ==========================================
// MOTEUR AUDIO AUDIO-CONTEXT PROCEDURAL
// ==========================================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
    }
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterVolume.connect(this.ctx.destination);
        this.startAmbientDrone();
    }
    startAmbientDrone() {
        setInterval(() => {
            if(!this.ctx || Math.random() > 0.4) return;
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(45 + Math.random() * 20, this.ctx.currentTime);
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 5);
            osc.connect(gain);
            gain.connect(this.masterVolume);
            osc.start();
            osc.stop(this.ctx.currentTime + 5);
        }, 4000);
    }
    playBeep(freq, duration, volume = 0.1) {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playScare() {
        if (!this.ctx) return;
        let now = this.ctx.currentTime;
        let bufferSize = this.ctx.sampleRate * 0.5;
        let buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        let noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        let noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        let osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.4);

        noise.connect(noiseGain);
        noiseGain.connect(this.masterVolume);
        osc.connect(noiseGain);
        
        noise.start();
        osc.start();
        noise.stop(now + 0.5);
        osc.stop(now + 0.5);
    }
    playFootstep() { this.playBeep(80, 0.08, 0.05); }
}
const audio = new AudioEngine();

// DATA SETS
const EQUIPMENTS = [
    { id: 'none', name: "Aucun", cost: 0, desc: "Rien en main gauche. Vitesse optimale.", spec: "Aucun drain." },
    { id: 'emf', name: "Détecteur EMF-5", cost: 1.5, desc: "Mesure les fluctuations magnétiques.", spec: "Bippe près du fantôme." },
    { id: 'thermo', name: "Thermomètre Digital", cost: 2.0, desc: "Analyse les températures.", spec: "Décèle les zones sous 0°C." },
    { id: 'nightvision', name: "Vision Nocturne IR", cost: 4.5, desc: "Modifie le spectre optique.", spec: "Permet de voir les orbes." },
    { id: 'scanner', name: "Scanner RADAR", cost: 5.0, desc: "Capture les distorsions d'ondes.", spec: "Détecte la signature géométrique." },
    { id: 'micro', name: "Microphone EVP", cost: 2.5, desc: "Capte les ultra-fréquences vocales.", spec: "Affiche les murmures spectraux." }
];

const GHOST_TYPES = {
    'Observateur': { name: 'Observateur', speed: 0.03, aggro: 0.2, evidence: ['emf5', 'orbs'], logic: "Suit à distance." },
    'Agressif': { name: 'Agressif', speed: 0.055, aggro: 0.7, evidence: ['emf5', 'freezing'], logic: "Chasse ultra-rapide." },
    'Imitateur': { name: 'Imitateur', speed: 0.04, aggro: 0.4, evidence: ['evp', 'orbs'], logic: "Faux bruits de pas." },
    'Trompeur': { name: 'Trompeur', speed: 0.035, aggro: 0.3, evidence: ['scanner', 'emf5'], logic: "Fausses preuves distantes." },
    'Silencieux': { name: 'Silencieux', speed: 0.045, aggro: 0.5, evidence: ['freezing', 'evp'], logic: "Zéro bruit, gel total." }
};

const Game = {
    stats: { wins: 0, losses: 0 },
    player: { x: 0, z: 0, rotY: 0, rotX: 0, speed: 0.08, sanity: 100, battery: 100, activeEquip: 'none', isCrouching: false, isSprinting: false, height: 1.6 },
    ghost: { type: null, x: 0, z: 0, roomX: 0, roomZ: 0, anger: 0, state: 'WANDER', timer: 0, evidenceSeen: { emf5: false, freezing: false, orbs: false, evp: false, scanner: false } },
    map: { grid: [], size: 16, scale: 4, batteries: [] },
    ui: {}, input: {}, three: {}, isPaused: true, isOver: false,

    init() {
        this.loadProgress();
        this.setupUI();
        this.setupInput();
        this.build3DWorld();
        this.resetSession();
        animate();
    },
    loadProgress() {
        const saved = localStorage.getItem('echoes_paranormal_save');
        if (saved) { try { this.stats = JSON.parse(saved); } catch(e){} }
        document.getElementById('stats-win').innerText = this.stats.wins;
        document.getElementById('stats-loss').innerText = this.stats.losses;
    },
    saveProgress() {
        localStorage.setItem('echoes_paranormal_save', JSON.stringify(this.stats));
        document.getElementById('stats-win').innerText = this.stats.wins;
        document.getElementById('stats-loss').innerText = this.stats.losses;
    },
    setupUI() {
        this.ui.sanityFill = document.getElementById('sanity-fill');
        this.ui.sanityVal = document.getElementById('sanity-val');
        this.ui.batteryFill = document.getElementById('battery-fill');
        this.ui.batteryVal = document.getElementById('battery-val');
        this.ui.eqName = document.getElementById('eq-name');
        this.ui.eqScreen = document.getElementById('equipment-screen');
        this.ui.prompt = document.getElementById('interaction-prompt');

        const container = document.getElementById('inv-grid-container');
        container.innerHTML = '';
        EQUIPMENTS.forEach(eq => {
            let slot = document.createElement('div');
            slot.className = `inventory-slot ${this.player.activeEquip === eq.id ? 'active-slot' : ''}`;
            slot.innerHTML = `<div class="slot-name">${eq.name}</div><div class="slot-meta">Drain: ${eq.cost}/s</div>`;
            slot.onclick = () => {
                document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('active-slot'));
                slot.classList.add('active-slot');
                this.player.activeEquip = eq.id;
                this.ui.eqName.innerText = eq.name;
                document.getElementById('inv-description').innerHTML = `<strong>${eq.desc}</strong><br><em style="color:#fff;">Effet: ${eq.spec}</em>`;
                if(eq.id === 'nightvision') document.body.classList.add('nightvision-mode');
                else document.body.classList.remove('nightvision-mode');
            };
            container.appendChild(slot);
        });

        document.getElementById('btn-start-game').onclick = () => {
            audio.init();
            document.getElementById('menu-main').classList.add('hidden');
            this.isPaused = false;
            document.body.requestPointerLock();
        };
        document.getElementById('btn-close-inventory').onclick = () => this.toggleInventory(false);
        document.getElementById('btn-close-journal').onclick = () => this.toggleJournal(false);
        document.getElementById('btn-restart').onclick = () => {
            document.getElementById('menu-gameover').classList.add('hidden');
            this.resetSession();
            document.getElementById('menu-main').classList.remove('hidden');
        };
        document.getElementById('btn-submit-investigation').onclick = () => this.concludeInvestigation();
    },
    setupInput() {
        window.addEventListener('keydown', (e) => {
            let key = e.key.toLowerCase();
            if(key === 'z' || key === 'w' || e.keyCode === 38) this.input.forward = true;
            if(key === 's' || e.keyCode === 40) this.input.backward = true;
            if(key === 'q' || key === 'a' || e.keyCode === 37) this.input.left = true;
            if(key === 'd' || e.keyCode === 39) this.input.right = true;
            if(e.keyCode === 16) this.player.isSprinting = true;
            if(e.keyCode === 17) this.player.isCrouching = true;
            if(key === 'tab') { e.preventDefault(); this.toggleInventory(); }
            if(key === 'j') { e.preventDefault(); this.toggleJournal(); }
            if(e.keyCode === 27) { this.isPaused = true; }
            if(key === 'e') { this.interactWithWorld(); }
        });
        window.addEventListener('keyup', (e) => {
            let key = e.key.toLowerCase();
            if(key === 'z' || key === 'w' || e.keyCode === 38) this.input.forward = false;
            if(key === 's' || e.keyCode === 40) this.input.backward = false;
            if(key === 'q' || key === 'a' || e.keyCode === 37) this.input.left = false;
            if(key === 'd' || e.keyCode === 39) this.input.right = false;
            if(e.keyCode === 16) this.player.isSprinting = false;
            if(e.keyCode === 17) this.player.isCrouching = false;
        });
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== document.body || this.isPaused) return;
            this.player.rotY -= e.movementX * 0.0025;
            this.player.rotX -= e.movementY * 0.0025;
            this.player.rotX = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, this.player.rotX));
        });
    },
    notify(text) {
        const zone = document.getElementById('notification-zone');
        const n = document.createElement('div');
        n.className = "notification";
        n.innerText = text;
        zone.appendChild(n);
        setTimeout(() => n.remove(), 4000);
    },
    toggleInventory(force) {
        const inv = document.getElementById('menu-inventory');
        let open = force !== undefined ? force : inv.classList.contains('hidden');
        if(open) { inv.classList.remove('hidden'); this.isPaused = true; document.exitPointerLock(); }
        else { inv.classList.add('hidden'); this.isPaused = false; document.body.requestPointerLock(); }
    },
    toggleJournal(force) {
        const jrn = document.getElementById('menu-journal');
        let open = force !== undefined ? force : jrn.classList.contains('hidden');
        if(open) { jrn.classList.remove('hidden'); this.isPaused = true; document.exitPointerLock(); }
        else { jrn.classList.add('hidden'); this.isPaused = false; document.body.requestPointerLock(); }
    },
    build3DWorld() {
        const container = document.getElementById('canvas-container');
        this.three.scene = new THREE.Scene();
        this.three.scene.fog = new THREE.FogExp2(0x020202, 0.08);

        this.three.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.three.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.three.renderer.setSize(window.innerWidth, window.innerHeight);
        this.three.renderer.shadowMap.enabled = true;
        container.appendChild(this.three.renderer.domElement);

        this.three.scene.add(new THREE.AmbientLight(0x08080c));
        this.three.headlight = new THREE.SpotLight(0xffffff, 1.2, 25, Math.PI / 5, 0.5, 1);
        this.three.headlight.castShadow = true;
        this.three.scene.add(this.three.headlight);
        this.three.headlightTarget = new THREE.Object3D();
        this.three.scene.add(this.three.headlightTarget);
        this.three.headlight.target = this.three.headlightTarget;

        this.generateMapStructure();

        this.three.ghostMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshBasicMaterial({color: 0x00ff66, wireframe: true, transparent: true, opacity: 0.0}));
        this.three.scene.add(this.three.ghostMesh);

        window.addEventListener('resize', () => {
            this.three.camera.aspect = window.innerWidth / window.innerHeight;
            this.three.camera.updateProjectionMatrix();
            this.three.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    },
    generateMapStructure() {
        const size = this.map.size, scale = this.map.scale;
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x221e1a, roughness: 0.9 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.7 });
        for (let x = 0; x < size; x++) {
            this.map.grid[x] = [];
            for (let z = 0; z < size; z++) {
                let isWall = (x === 0 || x === size-1 || z === 0 || z === size-1);
                if(!isWall && (x % 4 === 0 || z % 4 === 0)) isWall = Math.random() > 0.25;
                if(x < 4 && z < 4) isWall = false;
                this.map.grid[x][z] = isWall;

                let posX = x * scale - (size * scale) / 2;
                let posZ = z * scale - (size * scale) / 2;

                if (isWall) {
                    let wall = new THREE.Mesh(new THREE.BoxGeometry(scale, 3.5, scale), wallMat);
                    wall.position.set(posX, 1.75, posZ);
                    wall.castShadow = true; wall.receiveShadow = true;
                    this.three.scene.add(wall);
                } else {
                    let floor = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), floorMat);
                    floor.rotation.x = -Math.PI / 2; floor.position.set(posX, 0, posZ);
                    floor.receiveShadow = true; this.three.scene.add(floor);
                    if((x > 4 || z > 4) && Math.random() < 0.06) this.spawnBatteryItem(posX, posZ, x, z);
                }
            }
        }
    },
    spawnBatteryItem(x, z, gridX, gridZ) {
        let mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8), new THREE.MeshStandardMaterial({color: 0xffb000, emissive: 0x442a00}));
        mesh.position.set(x + (Math.random()-0.5), 0.125, z + (Math.random()-0.5));
        this.three.scene.add(mesh);
        this.map.batteries.push({ mesh, gridX, gridZ });
    },
    resetSession() {
        this.isOver = false; this.player.sanity = 100; this.player.battery = 100; this.player.activeEquip = 'none';
        document.body.classList.remove('nightvision-mode');
        this.player.x = - (this.map.size * this.map.scale) / 2 + 6;
        this.player.z = - (this.map.size * this.map.scale) / 2 + 6;
        this.player.rotX = 0; this.player.rotY = Math.PI / 4;

        const types = Object.keys(GHOST_TYPES);
        this.ghost.type = GHOST_TYPES[types[Math.floor(Math.random() * types.length)]];
        this.ghost.anger = 0; this.ghost.state = 'WANDER';
        this.ghost.roomX = Math.floor(8 + Math.random() * 6);
        this.ghost.roomZ = Math.floor(8 + Math.random() * 6);
        this.ghost.x = this.ghost.roomX * this.map.scale - (this.map.size * this.map.scale) / 2;
        this.ghost.z = this.ghost.roomZ * this.map.scale - (this.map.size * this.map.scale) / 2;

        document.getElementById('location-ui').innerText = "LIEU : " + ["MANOIR", "ASILE", "LYCÉE", "LABO"][Math.floor(Math.random() * 4)];
        this.notify("Investigation commencée. Trouvez l'entité.");
    },
    interactWithWorld() {
        if(this.isPaused || this.isOver) return;
        let px = Math.floor((this.player.x + (this.map.size * this.map.scale) / 2) / this.map.scale);
        let pz = Math.floor((this.player.z + (this.map.size * this.map.scale) / 2) / this.map.scale);
        for(let i = this.map.batteries.length - 1; i >= 0; i--) {
            let bat = this.map.batteries[i];
            if(bat.gridX === px && bat.gridZ === pz) {
                this.player.battery = Math.min(100, this.player.battery + 40);
                this.three.scene.remove(bat.mesh);
                this.map.batteries.splice(i, 1);
                audio.playBeep(600, 0.15, 0.2);
                this.notify("Batterie de rechange récupérée (+40%)");
                return;
            }
        }
    },
    concludeInvestigation() {
        const choice = document.getElementById('ghost-select-conclusion').value;
        if(!choice) return alert("Sélectionnez une hypothèse.");
        this.isOver = true; this.isPaused = true; document.exitPointerLock();
        document.getElementById('menu-journal').classList.add('hidden');
        document.getElementById('menu-gameover').classList.remove('hidden');

        const title = document.getElementById('gameover-title'), text = document.getElementById('gameover-text'), details = document.getElementById('gameover-details');
        if(choice === this.ghost.type.name) {
            title.innerText = "MISSION RÉUSSIE"; title.style.color = "#00ff66";
            text.innerText = `L'entité était bien un : ${this.ghost.type.name}`;
            details.innerHTML = `Extraction réussie. Santé mentale résiduelle : ${Math.floor(this.player.sanity)}%.`;
            this.stats.wins++;
        } else {
            title.innerText = "ÉCHEC DE L'ENQUÊTE"; title.style.color = "#ff3333";
            text.innerText = `Faux diagnostic. Vous avez choisi ${choice}.`;
            details.innerHTML = `Le spectre était un <strong>${this.ghost.type.name}</strong>.`;
            this.stats.losses++;
        }
        this.saveProgress();
    },
    killPlayer() {
        this.isOver = true; this.isPaused = true; document.exitPointerLock(); audio.playScare();
        document.getElementById('menu-gameover').classList.remove('hidden');
        document.getElementById('gameover-title').innerText = "VOUS AVEZ PÉRI";
        document.getElementById('gameover-text').innerText = "Votre santé mentale a sombré.";
        document.getElementById('gameover-details').innerHTML = `L'entité était un <strong>${this.ghost.type.name}</strong>.`;
        this.stats.losses++; this.saveProgress();
    },
    updateLogic(delta) {
        if (this.isPaused || this.isOver) return;
        this.updatePlayerMovement(delta);
        this.updateEquipmentAndBattery(delta);
        this.updateGhostAI(delta);
        this.updateSanitySystem(delta);
    },
    updatePlayerMovement(delta) {
        let speed = this.player.speed;
        if (this.player.isSprinting && this.player.sanity > 20) speed *= 1.6;
        if (this.player.isCrouching) speed *= 0.5;

        this.player.height += ((this.player.isCrouching ? 0.9 : 1.6) - this.player.height) * 0.1;
        let moveX = 0, moveZ = 0;

        if (this.input.forward) { moveX -= Math.sin(this.player.rotY); moveZ -= Math.cos(this.player.rotY); }
        if (this.input.backward) { moveX += Math.sin(this.player.rotY); moveZ += Math.cos(this.player.rotY); }
        if (this.input.left) { moveX -= Math.cos(this.player.rotY); moveZ += Math.sin(this.player.rotY); }
        if (this.input.right) { moveX += Math.cos(this.player.rotY); moveZ -= Math.sin(this.player.rotY); }

        if (moveX !== 0 || moveZ !== 0) {
            let len = Math.sqrt(moveX*moveX + moveZ*moveZ);
            moveX = (moveX / len) * speed; moveZ = (moveZ / len) * speed;
            let halfS = (this.map.size * this.map.scale) / 2;
            
            if(!this.map.grid[Math.floor((this.player.x + moveX + halfS) / this.map.scale)][Math.floor((this.player.z + halfS) / this.map.scale)]) this.player.x += moveX;
            if(!this.map.grid[Math.floor((this.player.x + halfS) / this.map.scale)][Math.floor((this.player.z + moveZ + halfS) / this.map.scale)]) this.player.z += moveZ;
            if(Math.random() < 0.04) audio.playFootstep();
        }

        this.three.camera.position.set(this.player.x, this.player.height, this.player.z);
        let target = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(1, 0, 0), this.player.rotX).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotY).add(this.three.camera.position);
        this.three.camera.lookAt(target);
        this.three.headlight.position.copy(this.three.camera.position);
        this.three.headlightTarget.position.copy(target);
    },
    updateEquipmentAndBattery(delta) {
        let active = EQUIPMENTS.find(e => e.id === this.player.activeEquip);
        if (active && active.cost > 0) {
            if (this.player.battery > 0) this.player.battery = Math.max(0, this.player.battery - active.cost * delta);
            else { this.player.activeEquip = 'none'; document.body.classList.remove('nightvision-mode'); audio.playBeep(180, 0.4, 0.3); }
        }
        this.ui.batteryFill.style.width = `${this.player.battery}%`;
        this.ui.batteryVal.innerText = Math.ceil(this.player.battery);
        this.runEquipmentOutput(active);
    },
    runEquipmentOutput(eq) {
        if (!eq || eq.id === 'none') return this.ui.eqScreen.innerHTML = "STANDBY - Lampe frontale active (0% batt)";
        let dist = this.three.camera.position.distanceTo(this.three.ghostMesh.position);
        switch(eq.id) {
            case 'emf':
                let lvl = dist < 2.5 && this.ghost.type.evidence.includes('emf5') ? 5 : dist < 4 ? 4 : dist < 7 ? 3 : dist < 12 ? 2 : 1;
                this.ui.eqScreen.innerHTML = `EMF-5 : ${"🟢".repeat(lvl)}${"⚪".repeat(5 - lvl)} (Niveau ${lvl})`;
                if(lvl > 1 && Math.random() < (lvl * 0.08)) audio.playBeep(400 + (lvl * 80), 0.05, 0.08);
                break;
            case 'thermo':
                let temp = 14.2 - (dist < 8 ? (8 - dist) * 2.5 : 0) - (dist < 8 && this.ghost.type.evidence.includes('freezing') ? 5 : 0);
                this.ui.eqScreen.innerHTML = `THERMOMÈTRE : <span style="color:${temp < 0 ? 'var(--horror-red)': '#fff'}">${temp.toFixed(1)}°C</span>`;
                break;
            case 'nightvision':
                this.ui.eqScreen.innerHTML = `FILTRE IR : ORBES DETECTÉS = ${this.ghost.type.evidence.includes('orbs') && dist < 10 ? 'OUI': 'NON'}`;
                break;
            case 'scanner':
                this.ui.eqScreen.innerHTML = `RADAR : ${dist < 9 && this.ghost.type.evidence.includes('scanner') ? 'DISTORSION PROCHE (+'+((10-dist)*10).toFixed(0)+'%)' : 'CLEAR'}`;
                break;
            case 'micro':
                this.ui.eqScreen.innerHTML = `EVP AMPLIFICATEUR : ${dist < 6 && this.ghost.type.evidence.includes('evp') && Math.random() < 0.3 ? '"VOIX CAPTÉE"' : 'STATIQUE'}`;
                break;
        }
    },
    updateGhostAI(delta) {
        this.ghost.timer += delta; this.ghost.anger += delta * 0.005 * this.ghost.type.aggro;
        if(this.ghost.timer > 8) {
            this.ghost.timer = 0;
            let roll = Math.random() * 100;
            if(roll < this.ghost.anger * 100 || this.player.sanity < 35) { this.ghost.state = 'HUNT'; this.notify("⚠️ Chasse spectrale en cours !"); }
            else this.ghost.state = Math.random() < 0.6 ? 'STALK' : 'WANDER';
        }
        let speed = this.ghost.type.speed * (this.ghost.state === 'HUNT' ? 1.5 : 1);
        let tx = this.ghost.x, tz = this.ghost.z;
        if (this.ghost.state === 'WANDER') {
            let halfS = (this.map.size * this.map.scale) / 2;
            tx = this.ghost.roomX * this.map.scale - halfS + Math.sin(Date.now()*0.0005)*3;
            tz = this.ghost.roomZ * this.map.scale - halfS + Math.cos(Date.now()*0.0005)*3;
        } else { tx = this.player.x; tz = this.player.z; }
        this.ghost.x += (tx - this.ghost.x) * speed; this.ghost.z += (tz - this.ghost.z) * speed;
        this.three.ghostMesh.position.set(this.ghost.x, 1.2, this.ghost.z);
    },
    updateSanitySystem(delta) {
        let dist = this.three.camera.position.distanceTo(this.three.ghostMesh.position);
        let loss = 0.4 + (dist < 6 ? (6 - dist) * 2.5 : 0) * (this.ghost.state === 'HUNT' ? 2 : 1);
        this.player.sanity = Math.max(0, this.player.sanity - loss * delta);
        this.ui.sanityFill.style.width = `${this.player.sanity}%`;
        this.ui.sanityVal.innerText = Math.ceil(this.player.sanity);

        document.getElementById('glitch-overlay').style.opacity = this.player.sanity < 40 ? (1.0 - (this.player.sanity / 40)) * 0.15 : 0;
        if(this.player.sanity <= 0 || (dist < 1.2 && this.ghost.state === 'HUNT')) this.killPlayer();
        
        let px = Math.floor((this.player.x + (this.map.size * this.map.scale) / 2) / this.map.scale);
        let pz = Math.floor((this.player.z + (this.map.size * this.map.scale) / 2) / this.map.scale);
        this.ui.prompt.style.display = this.map.batteries.some(b => b.gridX === px && b.gridZ === pz) ? 'block' : 'none';
    }
};

let clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    let delta = clock.getDelta();
    if(delta > 0.1) delta = 0.1;
    Game.updateLogic(delta);
    Game.three.renderer.render(Game.three.scene, Game.three.camera);
}

window.onload = () => { Game.init(); };
