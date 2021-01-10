var bgmPlayer = function(playlist,next=false){
  if(!next && playlist == AudioCtrl.playlist){
    return;
  } else {
    AudioCtrl.playlist = playlist;
    var src = playlist[Math.floor(Math.random() * playlist.length)];
    AudioCtrl.bgm.src = src;
    AudioCtrl.bgm.play();
    AudioCtrl.bgm.onended = function(){
      bgmPlayer(playlist,next=true);
    }
  }
};

var ambPlayer = function(src){
  if(src == AudioCtrl.amb.src){
    return;
  } else if(!src){
    AudioCtrl.amb.src = "";
  } else {
    AudioCtrl.amb.src = src;
    AudioCtrl.amb.loop = true;
    AudioCtrl.amb.play();
  }
};

AudioCtrl = {};
AudioCtrl.playlist = null;
AudioCtrl.bgm = new Audio();
AudioCtrl.amb = new Audio();

Bgm = {};

Bgm.absalon = '/client/audio/bgm/Absalon.mp3';
Bgm.aeternam = '/client/audio/bgm/Aeternam.mp3';
Bgm.alium = '/client/audio/bgm/Alium.mp3';
Bgm.alla_bataglia = '/client/audio/bgm/Alla_bataglia.mp3';
Bgm.alla_caccia = '/client/audio/bgm/Alla_caccia.mp3';
Bgm.alma = '/client/audio/bgm/Alma.mp3';
Bgm.alta = '/client/audio/bgm/Alta.mp3';
Bgm.alta2 = '/client/audio/bgm/Alta2.mp3';
Bgm.amor = '/client/audio/bgm/Amor.mp3';
Bgm.andalusi = '/client/audio/bgm/Andalusi.mp3';
Bgm.anello = '/client/audio/bgm/Anello.mp3';
Bgm.ardente = '/client/audio/bgm/Ardente.mp3';
Bgm.asbahan = '/client/audio/bgm/Asbahan.mp3';
Bgm.aucells = '/client/audio/bgm/Aucells.mp3';
Bgm.aventure = '/client/audio/bgm/Aventure.mp3';
Bgm.bashraf = '/client/audio/bgm/Bashraf.mp3';
Bgm.beaute = '/client/audio/bgm/Beaute.mp3';
Bgm.beliche = '/client/audio/bgm/Beliche.mp3';
Bgm.berdolin = '/client/audio/bgm/Berdolin.mp3';
Bgm.blazen = '/client/audio/bgm/Blazen.mp3';
Bgm.boessen = '/client/audio/bgm/Boessen.mp3';
Bgm.bonne = '/client/audio/bgm/Bonne.mp3';
Bgm.bourguignon = '/client/audio/bgm/Bourguignon.mp3';
Bgm.bourguignon2 = '/client/audio/bgm/Bourguignon2.mp3';
Bgm.brawle = '/client/audio/bgm/Brawle.mp3';
Bgm.caida = '/client/audio/bgm/Caida.mp3';
Bgm.ce_jour = '/client/audio/bgm/Ce_jour.mp3';
Bgm.chacona = '/client/audio/bgm/Chacona.mp3';
Bgm.chacona2 = '/client/audio/bgm/Chacona2.mp3';
Bgm.chanconeta = '/client/audio/bgm/Chanconeta.mp3';
Bgm.chanconeta2 = '/client/audio/bgm/Chanconeta2.mp3';
Bgm.chantar = '/client/audio/bgm/Chantar.mp3';
Bgm.collinetto = '/client/audio/bgm/Collinetto.mp3';
Bgm.collinetto2 = '/client/audio/bgm/Collinetto2.mp3';
Bgm.coloribus = '/client/audio/bgm/Coloribus.mp3';
Bgm.coloribus2 = '/client/audio/bgm/Coloribus2.mp3';
Bgm.conditor = '/client/audio/bgm/Conditor.mp3';
Bgm.constantia = '/client/audio/bgm/Constantia.mp3';
Bgm.coraige = '/client/audio/bgm/Coraige.mp3';
Bgm.corps_femenin = '/client/audio/bgm/Corps_femenin.mp3';
Bgm.costante = '/client/audio/bgm/Costante.mp3';
Bgm.danca = '/client/audio/bgm/Danca.mp3';
Bgm.danse_estampie = '/client/audio/bgm/Danse_estampie.mp3';
Bgm.danza = '/client/audio/bgm/Danza.mp3';
Bgm.deathe = '/client/audio/bgm/Deathe.mp3';
Bgm.defeat = '/client/audio/bgm/Defeat.mp3';
Bgm.desiosa = '/client/audio/bgm/Desiosa.mp3';
Bgm.domine = '/client/audio/bgm/Domine.mp3';
Bgm.doulse = '/client/audio/bgm/Doulse.mp3';
Bgm.dregz = '/client/audio/bgm/Dregz.mp3';
Bgm.ex_agone = '/client/audio/bgm/Ex_agone.mp3';
Bgm.ex_agone2 = '/client/audio/bgm/Ex_agone2.mp3';
Bgm.falla = '/client/audio/bgm/Falla.mp3';
Bgm.falla2 = '/client/audio/bgm/Falla2.mp3';
Bgm.fede = '/client/audio/bgm/Fede.mp3';
Bgm.feuers = '/client/audio/bgm/Feuers.mp3';
Bgm.folias = '/client/audio/bgm/Folias.mp3';
Bgm.folias2 = '/client/audio/bgm/Folias2.mp3';
Bgm.fortuna = '/client/audio/bgm/Fortuna.mp3';
Bgm.fuerza = '/client/audio/bgm/Fuerza.mp3';
Bgm.gedeon = '/client/audio/bgm/Gedeon.mp3';
Bgm.gedeon2 = '/client/audio/bgm/Gedeon2.mp3';
Bgm.generosa = '/client/audio/bgm/Generosa.mp3';
Bgm.gentil_cuer = '/client/audio/bgm/Gentil_cuer.mp3';
Bgm.gentil_cuer2 = '/client/audio/bgm/Gentil_cuer2.mp3';
Bgm.gotxs = '/client/audio/bgm/Gotxs.mp3';
Bgm.gran_fuoco = '/client/audio/bgm/Gran_fuoco.mp3';
Bgm.gugurumbe = '/client/audio/bgm/Gugurumbe.mp3';
Bgm.hedyaz = '/client/audio/bgm/Hedyaz.mp3';
Bgm.helas_pitie = '/client/audio/bgm/Helas_pitie.mp3';
Bgm.irae = '/client/audio/bgm/Irae.mp3';
Bgm.jatendray = '/client/audio/bgm/Jatendray.mp3';
Bgm.judici = '/client/audio/bgm/Judici.mp3';
Bgm.la_fiamma = '/client/audio/bgm/La_fiamma.mp3';
Bgm.la_verdelete = '/client/audio/bgm/La_verdelete.mp3';
Bgm.la_verdelete2 = '/client/audio/bgm/La_verdelete2.mp3';
Bgm.lannoys = '/client/audio/bgm/Lannoys.mp3';
Bgm.leandro = '/client/audio/bgm/Leandro.mp3';
Bgm.liement = '/client/audio/bgm/Liement.mp3';
Bgm.lux = '/client/audio/bgm/Lux.mp3';
Bgm.mabellist = '/client/audio/bgm/Mabellist.mp3';
Bgm.madonna_katerina = '/client/audio/bgm/Madonna_katerina.mp3';
Bgm.magnificat = '/client/audio/bgm/Magnificat.mp3';
Bgm.mater = '/client/audio/bgm/Mater.mp3';
Bgm.mephisto = '/client/audio/bgm/Mephisto.mp3';
Bgm.mio = '/client/audio/bgm/Mio.mp3';
Bgm.miri = '/client/audio/bgm/Miri.mp3';
Bgm.moriar = '/client/audio/bgm/Moriar.mp3';
Bgm.morseca = '/client/audio/bgm/Morseca.mp3';
Bgm.morte = '/client/audio/bgm/Morte.mp3';
Bgm.mulierum = '/client/audio/bgm/Mulierum.mp3';
Bgm.mundi = '/client/audio/bgm/Mundi.mp3';
Bgm.musica = '/client/audio/bgm/Musica.mp3';
Bgm.naroit = '/client/audio/bgm/Naroit.mp3';
Bgm.naturalmente = '/client/audio/bgm/Naturalmente.mp3';
Bgm.non_ara_may = '/client/audio/bgm/Non_ara_may.mp3';
Bgm.occasus = '/client/audio/bgm/Occasus.mp3';
Bgm.par_maintes = '/client/audio/bgm/Par_maintes.mp3';
Bgm.par_mantes2 = '/client/audio/bgm/Par_mantes2.mp3';
Bgm.paradis = '/client/audio/bgm/Paradis.mp3';
Bgm.paradiso = '/client/audio/bgm/Paradiso.mp3';
Bgm.paradisum = '/client/audio/bgm/Paradisum.mp3';
Bgm.passamezzo = '/client/audio/bgm/Passamezzo.mp3';
Bgm.pavana = '/client/audio/bgm/Pavana.mp3';
Bgm.peccata_nostra = '/client/audio/bgm/Peccata_nostra.mp3';
Bgm.plainte = '/client/audio/bgm/Plainte.mp3';
Bgm.playne = '/client/audio/bgm/Playne.mp3';
Bgm.playsant = '/client/audio/bgm/Playsant.mp3';
Bgm.profundis = '/client/audio/bgm/Profundis.mp3';
Bgm.propinan = '/client/audio/bgm/Propinan.mp3';
Bgm.quant_joyne = '/client/audio/bgm/Quant_joyne.mp3';
Bgm.questamor = '/client/audio/bgm/Questamor.mp3';
Bgm.qui = '/client/audio/bgm/Qui.mp3';
Bgm.recercada = '/client/audio/bgm/Recercada.mp3';
Bgm.revenez = '/client/audio/bgm/Revenez.mp3';
Bgm.riches = '/client/audio/bgm/Riches.mp3';
Bgm.riches2 = '/client/audio/bgm/Riches2.mp3';
Bgm.ricorditi = '/client/audio/bgm/Ricorditi.mp3';
Bgm.romanesca = '/client/audio/bgm/Romanesca.mp3';
Bgm.saltarello = '/client/audio/bgm/Saltarello.mp3';
Bgm.saltarello2 = '/client/audio/bgm/Saltarello2.mp3';
Bgm.se_zephirus = '/client/audio/bgm/Se_zephirus.mp3';
Bgm.se_zephirus2 = '/client/audio/bgm/Se_zephirus2.mp3';
Bgm.se_zephirus3 = '/client/audio/bgm/Se_zephirus3.mp3';
Bgm.sera = '/client/audio/bgm/Sera.mp3';
Bgm.shatakhi = '/client/audio/bgm/Shatakhi.mp3';
Bgm.spagnoletta = '/client/audio/bgm/Spagnoletta.mp3';
Bgm.specchio = '/client/audio/bgm/Specchio.mp3';
Bgm.spiritus = '/client/audio/bgm/Spiritus.mp3';
Bgm.stingo2 = '/client/audio/bgm/Stingo2.mp3';
Bgm.sub_arturo = '/client/audio/bgm/Sub_arturo.mp3';
Bgm.sybilla = '/client/audio/bgm/Sybilla.mp3';
Bgm.tandernaken = '/client/audio/bgm/Tandernaken.mp3';
Bgm.tousjours = '/client/audio/bgm/Tousjours.mp3';
Bgm.tout_par = '/client/audio/bgm/Tout_par.mp3';
Bgm.tout_par2 = '/client/audio/bgm/Tout_par2.mp3';
Bgm.tout_par3 = '/client/audio/bgm/Tout_par3.mp3';
Bgm.toute_flour = '/client/audio/bgm/Toute_flour.mp3';
Bgm.triste = '/client/audio/bgm/Triste.mp3';
Bgm.trompette = '/client/audio/bgm/Trompette.mp3';
Bgm.uitime = '/client/audio/bgm/Uitime.mp3';
Bgm.untitled = '/client/audio/bgm/Untitled.mp3';
Bgm.vaguza = '/client/audio/bgm/Vaguza.mp3';
Bgm.veder = '/client/audio/bgm/Veder.mp3';
Bgm.villanicco = '/client/audio/bgm/Villanicco.mp3';
Bgm.virgen = '/client/audio/bgm/Virgen.mp3';
Bgm.virgo = '/client/audio/bgm/Virgo.mp3';
Bgm.volgra = '/client/audio/bgm/Volgra.mp3';
Bgm.zappay = '/client/audio/bgm/Zappay.mp3';
Bgm.zappay2 = '/client/audio/bgm/Zappay2.mp3';
Bgm.zappay3 = '/client/audio/bgm/Zappay3.mp3';
Bgm.zappay4 = '/client/audio/bgm/Zappay4.mp3';
Bgm.zidane = '/client/audio/bgm/Zidane.mp3';
Bgm.zurni = '/client/audio/bgm/Zurni.mp3';

var cathedral_bgm = [
  Bgm.alium,
  Bgm.alma,
  Bgm.aeternam,
  Bgm.peccata_nostra,
  Bgm.magnificat
];

var cave_bgm = [
  Bgm.mater,
  Bgm.mulierum,
  Bgm.virgo,
  Bgm.coraige,
  Bgm.judici,
  Bgm.aucells,
  Bgm.plainte
];

var dungeons_bgm = [
  Bgm.mundi,
  Bgm.caida,
  Bgm.generosa,
  Bgm.irae,
  Bgm.morte,
  Bgm.leandro,
  Bgm.fuerza,
  Bgm.hedyaz,
  Bgm.bashraf,
  Bgm.andalusi
];

var indoors_bgm = [
  Bgm.saltarello2,
  Bgm.stingo2,
  Bgm.virgen,
  Bgm.tout_par,
  Bgm.blazen,
  Bgm.sub_arturo,
  Bgm.spagnoletta,
  Bgm.recercada,
  Bgm.playne,
  Bgm.feuers,
  Bgm.naroit,
  Bgm.toute_flour,
  Bgm.paradis,
  Bgm.chanconeta2,
  Bgm.ricorditi,
  Bgm.doulse,
  Bgm.coloribus2,
  Bgm.lannoys,
  Bgm.ardente
];

var monastery_bgm = [
  Bgm.profundis,
  Bgm.spiritus,
  Bgm.domine,
  Bgm.lux,
  Bgm.paradisum
];

var overworld_morning_bgm = [
  Bgm.beaute,
  Bgm.brawle,
  Bgm.untitled,
  Bgm.par_maintes,
  Bgm.riches2,
  Bgm.se_zephirus3,
  Bgm.sera,
  Bgm.tout_par2,
  Bgm.tousjours,
  Bgm.revenez,
  Bgm.helas_pitie,
  Bgm.questamor,
  Bgm.musica,
  Bgm.veder,
  Bgm.ce_jour
];

var overworld_day_bgm = [
  Bgm.corps_femenin,
  Bgm.aventure,
  Bgm.gedeon,
  Bgm.gentil_cuer,
  Bgm.jatendray,
  Bgm.la_verdelete,
  Bgm.se_zephirus,
  Bgm.non_ara_may,
  Bgm.tout_par3,
  Bgm.qui,
  Bgm.quant_joyne,
  Bgm.tandernaken,
  Bgm.collinetto,
  Bgm.coloribus,
  Bgm.fortuna,
  Bgm.playsant
];

var overworld_night_bgm = [
  Bgm.chanconeta,
  Bgm.falla2,
  Bgm.la_verdelete2,
  Bgm.liement,
  Bgm.mephisto,
  Bgm.riches,
  Bgm.se_zephirus2,
  Bgm.gentil_cuer2,
  Bgm.la_fiamma,
  Bgm.chantar,
  Bgm.triste,
  Bgm.conditor,
  Bgm.deathe,
  Bgm.tousjours,
  Bgm.constantia,
  Bgm.bonne,
  Bgm.falla,
  Bgm.gedeon2,
  Bgm.specchio
];

var ship_bgm = [
  Bgm.shatakhi,
  Bgm.uitime,
  Bgm.ex_agone2,
  Bgm.naturalmente,
  Bgm.asbahan,
  Bgm.volgra,
  Bgm.danse_estampie,
  Bgm.berdolin,
  Bgm.dregz,
  Bgm.occasus
];

var stronghold_day_bgm = [
  Bgm.alla_caccia,
  Bgm.danca,
  Bgm.bourguignon,
  Bgm.zappay,
  Bgm.bourguignon2,
  Bgm.alta,
  Bgm.sybilla,
  Bgm.alta2,
  Bgm.propinan,
  Bgm.trompette,
  Bgm.zappay2,
  Bgm.alla_bataglia,
  Bgm.amor,
  Bgm.collinetto2,
  Bgm.vaguza,
  Bgm.fede,
  Bgm.desiosa,
  Bgm.pavana,
  Bgm.moriar
];

var stronghold_night_bgm = [
  Bgm.zappay3,
  Bgm.villanicco,
  Bgm.mio,
  Bgm.costante,
  Bgm.passamezzo,
  Bgm.romanesca,
  Bgm.folias,
  Bgm.mabellist,
  Bgm.gotxs,
  Bgm.chacona,
  Bgm.morseca,
  Bgm.gugurumbe,
  Bgm.folias2,
  Bgm.gran_fuoco
];

var tavern_bgm = [
  Bgm.anello,
  Bgm.madonna_katerina,
  Bgm.saltarello,
  Bgm.danse_estampie,
  Bgm.ex_agone,
  Bgm.dregz,
  Bgm.par_mantes2,
  Bgm.zappay4,
  Bgm.berdolin,
  Bgm.absalon,
  Bgm.danza,
  Bgm.beliche,
  Bgm.chacona2,
  Bgm.paradiso
];

var title_bgm = [
  Bgm.danca,
  Bgm.danca,
  Bgm.danca,
  Bgm.miri,
  Bgm.moriar,
  Bgm.tousjours,
  Bgm.saltarello2
];

Amb = {};

Amb.cave = '/client/audio/amb/cave.mp3';
Amb.chatter = '/client/audio/amb/chatter.mp3';
Amb.empty = '/client/audio/amb/empty.mp3';
Amb.evil = '/client/audio/amb/evil.mp3';
Amb.fire = '/client/audio/amb/fire.mp3';
Amb.forest = '/client/audio/amb/forest.mp3';
Amb.hush = '/client/audio/amb/hush.mp3';
Amb.mountains = '/client/audio/amb/mountains.mp3';
Amb.nature = '/client/audio/amb/nature.mp3';
Amb.rain = '/client/audio/amb/rain.mp3';
Amb.ritual = '/client/audio/amb/cave.mp3';
Amb.sea = '/client/audio/amb/sea.mp3';
Amb.seastorm = '/client/audio/amb/seastorm.mp3';
Amb.sinister = '/client/audio/amb/sinister.mp3';
Amb.spirits = '/client/audio/amb/spirits.mp3';
Amb.torture = '/client/audio/amb/torture.mp3';
Amb.underwater = '/client/audio/amb/underwater.mp3';
Amb.windy = '/client/audio/amb/windy.mp3';
