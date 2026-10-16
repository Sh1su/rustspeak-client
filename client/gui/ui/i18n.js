// Interface translations. The UI is written in German; this layer translates
// rendered text nodes and title/placeholder attributes live (MutationObserver),
// including dynamic messages via patterns. User content (names, chat, descriptions)
// is never translated.

const LANGS = { de: 'Deutsch', en: 'English', es: 'Español', ru: 'Русский', da: 'Dansk', sv: 'Svenska', pt: 'Português', zh: '中文', ja: '日本語' };
const LANG_ORDER = ['de', 'en', 'es', 'ru', 'da', 'sv', 'pt', 'zh', 'ja'];
const SPEECH_LANG = { de: 'de-DE', en: 'en-US', es: 'es-ES', ru: 'ru-RU', da: 'da-DK', sv: 'sv-SE', pt: 'pt-PT', zh: 'zh-CN', ja: 'ja-JP' };

// [de, en, es, ru, da, sv, pt, zh, ja]
const I18N_ROWS = [
  // ---------------------------------------------------------------- menus / toolbar
  ['Verbindungen', 'Connections', 'Conexiones', 'Подключения', 'Forbindelser', 'Anslutningar', 'Conexões', '连接', '接続'],
  ['Favoriten', 'Bookmarks', 'Favoritos', 'Избранное', 'Favoritter', 'Favoriter', 'Favoritos', '收藏夹', 'ブックマーク'],
  ['Rechte', 'Permissions', 'Permisos', 'Права', 'Rettigheder', 'Behörigheter', 'Permissões', '权限', '権限'],
  ['Extras', 'Tools', 'Herramientas', 'Инструменты', 'Værktøjer', 'Verktyg', 'Ferramentas', '工具', 'ツール'],
  ['Verbinden', 'Connect', 'Conectar', 'Подключиться', 'Forbind', 'Anslut', 'Conectar', '连接', '接続'],
  ['Trennen', 'Disconnect', 'Desconectar', 'Отключиться', 'Afbryd', 'Koppla från', 'Desconectar', '断开', '切断'],
  ['Mikrofon', 'Microphone', 'Micrófono', 'Микрофон', 'Mikrofon', 'Mikrofon', 'Microfone', '麦克风', 'マイク'],
  ['Mikro aus', 'Mic off', 'Micro apagado', 'Микр. выкл.', 'Mik. fra', 'Mik. av', 'Micro desl.', '麦克风关', 'マイクOFF'],
  ['Lautsprecher', 'Speakers', 'Altavoces', 'Динамики', 'Højttalere', 'Högtalare', 'Altifalantes', '扬声器', 'スピーカー'],
  ['Ton aus', 'Sound off', 'Sonido apagado', 'Звук выкл.', 'Lyd fra', 'Ljud av', 'Som desl.', '声音关', 'サウンドOFF'],
  ['Anwesend', 'Present', 'Presente', 'На месте', 'Til stede', 'Närvarande', 'Presente', '在线', '在席'],
  ['Abwesend', 'Away', 'Ausente', 'Отошёл', 'Væk', 'Borta', 'Ausente', '离开', '離席'],
  ['Einstellungen', 'Settings', 'Ajustes', 'Настройки', 'Indstillinger', 'Inställningar', 'Definições', '设置', '設定'],
  ['Verbinden …', 'Connect …', 'Conectar …', 'Подключиться …', 'Forbind …', 'Anslut …', 'Conectar …', '连接 …', '接続 …'],
  ['In neuem Server-Tab verbinden …', 'Connect in new server tab …', 'Conectar en nueva pestaña …', 'Подключиться в новой вкладке …', 'Forbind i ny serverfane …', 'Anslut i ny serverflik …', 'Conectar num novo separador …', '在新的服务器标签页中连接 …', '新しいサーバータブで接続 …'],
  ['Erneut verbinden', 'Reconnect', 'Reconectar', 'Переподключиться', 'Genforbind', 'Återanslut', 'Reconectar', '重新连接', '再接続'],
  ['Von allen Servern trennen', 'Disconnect from all servers', 'Desconectar de todos los servidores', 'Отключиться от всех серверов', 'Afbryd fra alle servere', 'Koppla från alla servrar', 'Desconectar de todos os servidores', '断开所有服务器', '全サーバーから切断'],
  ['Server-Tab schließen', 'Close server tab', 'Cerrar pestaña', 'Закрыть вкладку сервера', 'Luk serverfane', 'Stäng serverflik', 'Fechar separador', '关闭服务器标签页', 'サーバータブを閉じる'],
  ['Serverinfo', 'Server info', 'Información del servidor', 'Информация о сервере', 'Serverinfo', 'Serverinfo', 'Informação do servidor', '服务器信息', 'サーバー情報'],
  ['Eigene Verbindungsinfo …', 'My connection info …', 'Mi información de conexión …', 'Моя информация о соединении …', 'Min forbindelsesinfo …', 'Min anslutningsinfo …', 'A minha informação de ligação …', '我的连接信息 …', '自分の接続情報 …'],
  ['Noch keine Favoriten', 'No bookmarks yet', 'Aún no hay favoritos', 'Пока нет избранного', 'Ingen favoritter endnu', 'Inga favoriter än', 'Ainda sem favoritos', '暂无收藏', 'ブックマークはまだありません'],
  ['Aktuellen Server hinzufügen …', 'Add current server …', 'Añadir servidor actual …', 'Добавить текущий сервер …', 'Tilføj nuværende server …', 'Lägg till aktuell server …', 'Adicionar servidor atual …', '添加当前服务器 …', '現在のサーバーを追加 …'],
  ['Favoriten verwalten …', 'Manage bookmarks …', 'Gestionar favoritos …', 'Управление избранным …', 'Administrer favoritter …', 'Hantera favoriter …', 'Gerir favoritos …', '管理收藏夹 …', 'ブックマークを管理 …'],
  ['Berechtigungsschlüssel verwenden …', 'Use privilege key …', 'Usar clave de privilegio …', 'Использовать ключ привилегий …', 'Brug rettighedsnøgle …', 'Använd behörighetsnyckel …', 'Usar chave de privilégio …', '使用权限密钥 …', '権限キーを使用 …'],
  ['Berechtigungsschlüssel erstellen …', 'Create privilege key …', 'Crear clave de privilegio …', 'Создать ключ привилегий …', 'Opret rettighedsnøgle …', 'Skapa behörighetsnyckel …', 'Criar chave de privilégio …', '创建权限密钥 …', '権限キーを作成 …'],
  ['Berechtigungsschlüssel anzeigen …', 'Show privilege keys …', 'Ver claves de privilegio …', 'Показать ключи привилегий …', 'Vis rettighedsnøgler …', 'Visa behörighetsnycklar …', 'Ver chaves de privilégio …', '查看权限密钥 …', '権限キーを表示 …'],
  ['Gruppen & Rechte verwalten …', 'Manage groups & permissions …', 'Gestionar grupos y permisos …', 'Управление группами и правами …', 'Administrer grupper og rettigheder …', 'Hantera grupper och behörigheter …', 'Gerir grupos e permissões …', '管理群组和权限 …', 'グループと権限の管理 …'],
  ['Icons verwalten …', 'Manage icons …', 'Gestionar iconos …', 'Управление значками …', 'Administrer ikoner …', 'Hantera ikoner …', 'Gerir ícones …', '管理图标 …', 'アイコンの管理 …'],
  ['Bannliste …', 'Ban list …', 'Lista de baneos …', 'Список банов …', 'Banliste …', 'Bannlista …', 'Lista de banimentos …', '封禁列表 …', 'BANリスト …'],
  ['Server bearbeiten …', 'Edit server …', 'Editar servidor …', 'Изменить сервер …', 'Rediger server …', 'Redigera server …', 'Editar servidor …', '编辑服务器 …', 'サーバーを編集 …'],
  ['Einstellungen …', 'Settings …', 'Ajustes …', 'Настройки …', 'Indstillinger …', 'Inställningar …', 'Definições …', '设置 …', '設定 …'],
  ['Mikrofon stumm', 'Microphone muted', 'Micrófono silenciado', 'Микрофон выключен', 'Mikrofon slået fra', 'Mikrofon avstängd', 'Microfone silenciado', '麦克风静音', 'マイクミュート'],
  ['Lautsprecher stumm', 'Speakers muted', 'Altavoces silenciados', 'Динамики выключены', 'Højttalere slået fra', 'Högtalare avstängda', 'Altifalantes silenciados', '扬声器静音', 'スピーカーミュート'],
  ['Abwesend …', 'Away …', 'Ausente …', 'Отошёл …', 'Væk …', 'Borta …', 'Ausente …', '离开 …', '離席 …'],
  ['Spitzname ändern …', 'Change nickname …', 'Cambiar apodo …', 'Изменить никнейм …', 'Skift kaldenavn …', 'Byt smeknamn …', 'Alterar alcunha …', '更改昵称 …', 'ニックネームを変更 …'],
  ['Chatverlauf leeren', 'Clear chat history', 'Borrar historial del chat', 'Очистить историю чата', 'Ryd chathistorik', 'Rensa chatthistorik', 'Limpar histórico do chat', '清空聊天记录', 'チャット履歴を消去'],
  ['Über RustSpeak', 'About RustSpeak', 'Acerca de RustSpeak', 'О RustSpeak', 'Om RustSpeak', 'Om RustSpeak', 'Sobre o RustSpeak', '关于 RustSpeak', 'RustSpeak について'],
  // ---------------------------------------------------------------- tree / context menus
  ['Nicht verbunden', 'Not connected', 'No conectado', 'Не подключено', 'Ikke forbundet', 'Inte ansluten', 'Não ligado', '未连接', '未接続'],
  ['Du bist mit keinem Server verbunden.', 'You are not connected to a server.', 'No estás conectado a ningún servidor.', 'Вы не подключены к серверу.', 'Du er ikke forbundet til en server.', 'Du är inte ansluten till någon server.', 'Não está ligado a nenhum servidor.', '你尚未连接到服务器。', 'サーバーに接続していません。'],
  ['Verbinde …', 'Connecting …', 'Conectando …', 'Подключение …', 'Forbinder …', 'Ansluter …', 'A ligar …', '正在连接 …', '接続中 …'],
  ['Channel erstellen …', 'Create channel …', 'Crear canal …', 'Создать канал …', 'Opret kanal …', 'Skapa kanal …', 'Criar canal …', '创建频道 …', 'チャンネルを作成 …'],
  ['Serverinfo aktualisieren', 'Refresh server info', 'Actualizar información', 'Обновить информацию', 'Opdater serverinfo', 'Uppdatera serverinfo', 'Atualizar informação', '刷新服务器信息', 'サーバー情報を更新'],
  ['Channel betreten', 'Join channel', 'Entrar al canal', 'Войти в канал', 'Gå ind i kanal', 'Gå med i kanal', 'Entrar no canal', '进入频道', 'チャンネルに参加'],
  ['Channel bearbeiten …', 'Edit channel …', 'Editar canal …', 'Изменить канал …', 'Rediger kanal …', 'Redigera kanal …', 'Editar canal …', '编辑频道 …', 'チャンネルを編集 …'],
  ['Channel-Icon …', 'Channel icon …', 'Icono del canal …', 'Значок канала …', 'Kanalikon …', 'Kanalikon …', 'Ícone do canal …', '频道图标 …', 'チャンネルアイコン …'],
  ['Unterchannel erstellen …', 'Create sub-channel …', 'Crear subcanal …', 'Создать подканал …', 'Opret underkanal …', 'Skapa underkanal …', 'Criar subcanal …', '创建子频道 …', 'サブチャンネルを作成 …'],
  ['Trenner erstellen …', 'Create spacer …', 'Crear separador …', 'Создать разделитель …', 'Opret skillelinje …', 'Skapa avdelare …', 'Criar separador …', '创建分隔符 …', 'スペーサーを作成 …'],
  ['Channel löschen', 'Delete channel', 'Eliminar canal', 'Удалить канал', 'Slet kanal', 'Ta bort kanal', 'Eliminar canal', '删除频道', 'チャンネルを削除'],
  ['Beschreibung ändern …', 'Change description …', 'Cambiar descripción …', 'Изменить описание …', 'Skift beskrivelse …', 'Ändra beskrivning …', 'Alterar descrição …', '更改描述 …', '説明を変更 …'],
  ['Nicht mehr abwesend', 'Back again', 'Ya no ausente', 'Больше не отошёл', 'Ikke længere væk', 'Inte längre borta', 'Já não ausente', '取消离开', '離席を解除'],
  ['Private Nachricht', 'Private message', 'Mensaje privado', 'Личное сообщение', 'Privat besked', 'Privat meddelande', 'Mensagem privada', '私聊', 'プライベートメッセージ'],
  ['Anstupsen …', 'Poke …', 'Dar un toque …', 'Ткнуть …', 'Prik …', 'Peta …', 'Cutucar …', '戳一下 …', 'つつく …'],
  ['In meinen Channel holen', 'Move to my channel', 'Traer a mi canal', 'Переместить в мой канал', 'Flyt til min kanal', 'Flytta till min kanal', 'Trazer para o meu canal', '拉到我的频道', '自分のチャンネルに移動'],
  ['Verbindungsinfo …', 'Connection info …', 'Información de conexión …', 'Информация о соединении …', 'Forbindelsesinfo …', 'Anslutningsinfo …', 'Informação de ligação …', '连接信息 …', '接続情報 …'],
  ['Servergruppen', 'Server groups', 'Grupos del servidor', 'Группы сервера', 'Servergrupper', 'Servergrupper', 'Grupos do servidor', '服务器群组', 'サーバーグループ'],
  ['Servergruppen zuweisen …', 'Assign server groups …', 'Asignar grupos del servidor …', 'Назначить группы сервера …', 'Tildel servergrupper …', 'Tilldela servergrupper …', 'Atribuir grupos do servidor …', '分配服务器群组 …', 'サーバーグループを割り当て …'],
  ['Channelgruppe', 'Channel group', 'Grupo del canal', 'Группа канала', 'Kanalgruppe', 'Kanalgrupp', 'Grupo do canal', '频道群组', 'チャンネルグループ'],
  ['Channelgruppe zuweisen …', 'Assign channel group …', 'Asignar grupo del canal …', 'Назначить группу канала …', 'Tildel kanalgruppe …', 'Tilldela kanalgrupp …', 'Atribuir grupo do canal …', '分配频道群组 …', 'チャンネルグループを割り当て …'],
  ['Aus Channel werfen …', 'Kick from channel …', 'Expulsar del canal …', 'Выгнать из канала …', 'Smid ud af kanal …', 'Sparka från kanal …', 'Expulsar do canal …', '踢出频道 …', 'チャンネルからキック …'],
  ['Vom Server werfen …', 'Kick from server …', 'Expulsar del servidor …', 'Выгнать с сервера …', 'Smid ud af server …', 'Sparka från server …', 'Expulsar do servidor …', '踢出服务器 …', 'サーバーからキック …'],
  ['Bannen …', 'Ban …', 'Banear …', 'Забанить …', 'Ban …', 'Bannlys …', 'Banir …', '封禁 …', 'BAN …'],
  ['Alle vom Server werfen …', 'Kick all from server …', 'Expulsar a todos del servidor …', 'Выгнать всех с сервера …', 'Smid alle ud af server …', 'Sparka alla från server …', 'Expulsar todos do servidor …', '全部踢出服务器 …', '全員をサーバーからキック …'],
  ['Auswahl aufheben', 'Clear selection', 'Quitar selección', 'Снять выделение', 'Ryd markering', 'Avmarkera', 'Limpar seleção', '取消选择', '選択を解除'],
  ['Servergruppen (Klick schaltet um, Menü bleibt offen)', 'Server groups (click toggles, menu stays open)', 'Grupos del servidor (clic alterna, el menú sigue abierto)', 'Группы сервера (клик переключает, меню остаётся открытым)', 'Servergrupper (klik skifter, menuen forbliver åben)', 'Servergrupper (klick växlar, menyn förblir öppen)', 'Grupos do servidor (clique alterna, o menu fica aberto)', '服务器群组（点击切换，菜单保持打开）', 'サーバーグループ（クリックで切替、メニューは開いたまま）'],
  // ---------------------------------------------------------------- info panel
  ['Channelgruppe', 'Channel group', 'Grupo del canal', 'Группа канала', 'Kanalgruppe', 'Kanalgrupp', 'Grupo do canal', '频道群组', 'チャンネルグループ'],
  ['Sprechkraft', 'Talk power', 'Poder de habla', 'Сила голоса', 'Taleret', 'Talkraft', 'Poder de fala', '发言权', '発言力'],
  ['Version', 'Version', 'Versión', 'Версия', 'Version', 'Version', 'Versão', '版本', 'バージョン'],
  ['Verbunden seit', 'Connected for', 'Conectado desde', 'Подключён', 'Forbundet i', 'Ansluten i', 'Ligado há', '已连接', '接続時間'],
  ['Untätig seit', 'Idle for', 'Inactivo desde', 'Неактивен', 'Inaktiv i', 'Inaktiv i', 'Inativo há', '空闲时间', 'アイドル時間'],
  ['Erstmals gesehen', 'First seen', 'Visto por primera vez', 'Впервые замечен', 'Først set', 'Först sedd', 'Visto pela primeira vez', '首次出现', '初回接続'],
  ['Status', 'Status', 'Estado', 'Статус', 'Status', 'Status', 'Estado', '状态', 'ステータス'],
  ['normal', 'normal', 'normal', 'обычный', 'normal', 'normal', 'normal', '正常', '通常'],
  ['kein Mikrofon', 'no microphone', 'sin micrófono', 'нет микрофона', 'ingen mikrofon', 'ingen mikrofon', 'sem microfone', '无麦克风', 'マイクなし'],
  ['nimmt auf', 'recording', 'grabando', 'записывает', 'optager', 'spelar in', 'a gravar', '正在录音', '録音中'],
  ['Nachricht', 'Message', 'Mensaje', 'Сообщение', 'Besked', 'Meddelande', 'Mensagem', '消息', 'メッセージ'],
  ['Anstupsen', 'Poke', 'Dar un toque', 'Ткнуть', 'Prik', 'Peta', 'Cutucar', '戳一下', 'つつく'],
  ['In meinen Channel', 'To my channel', 'A mi canal', 'В мой канал', 'Til min kanal', 'Till min kanal', 'Para o meu canal', '到我的频道', '自分のチャンネルへ'],
  ['Verbindungsinfo', 'Connection info', 'Información de conexión', 'Информация о соединении', 'Forbindelsesinfo', 'Anslutningsinfo', 'Informação de ligação', '连接信息', '接続情報'],
  ['(du)', '(you)', '(tú)', '(вы)', '(dig)', '(du)', '(você)', '（你）', '（あなた）'],
  ['Typ', 'Type', 'Tipo', 'Тип', 'Type', 'Typ', 'Tipo', '类型', '種類'],
  ['Clients', 'Clients', 'Clientes', 'Клиенты', 'Klienter', 'Klienter', 'Clientes', '客户端', 'クライアント'],
  ['Codec', 'Codec', 'Códec', 'Кодек', 'Codec', 'Codec', 'Codec', '编解码器', 'コーデック'],
  ['Benötigte Sprechkraft', 'Needed talk power', 'Poder de habla necesario', 'Нужная сила голоса', 'Nødvendig taleret', 'Nödvändig talkraft', 'Poder de fala necessário', '所需发言权', '必要な発言力'],
  ['Benötigte Beitrittskraft', 'Needed join power', 'Poder de entrada necesario', 'Нужная сила входа', 'Nødvendig adgangskraft', 'Nödvändig anslutningskraft', 'Poder de entrada necessário', '所需进入权', '必要な参加力'],
  ['Betreten', 'Join', 'Entrar', 'Войти', 'Gå ind', 'Gå med', 'Entrar', '进入', '参加'],
  ['Bearbeiten', 'Edit', 'Editar', 'Изменить', 'Rediger', 'Redigera', 'Editar', '编辑', '編集'],
  ['Kein Thema', 'No topic', 'Sin tema', 'Нет темы', 'Intet emne', 'Inget ämne', 'Sem tema', '无主题', 'トピックなし'],
  ['Trennerchannel', 'Spacer channel', 'Canal separador', 'Канал-разделитель', 'Skillelinjekanal', 'Avdelarkanal', 'Canal separador', '分隔频道', 'スペーサーチャンネル'],
  ['Permanent', 'Permanent', 'Permanente', 'Постоянный', 'Permanent', 'Permanent', 'Permanente', '永久', '永続'],
  ['Semi-permanent', 'Semi-permanent', 'Semipermanente', 'Полупостоянный', 'Semi-permanent', 'Semipermanent', 'Semipermanente', '半永久', '半永続'],
  ['Temporär', 'Temporary', 'Temporal', 'Временный', 'Midlertidig', 'Tillfällig', 'Temporário', '临时', '一時'],
  ['Channels', 'Channels', 'Canales', 'Каналы', 'Kanaler', 'Kanaler', 'Canais', '频道', 'チャンネル'],
  ['Laufzeit', 'Uptime', 'Tiempo activo', 'Время работы', 'Oppetid', 'Drifttid', 'Tempo ativo', '运行时间', '稼働時間'],
  ['Erstellt', 'Created', 'Creado', 'Создан', 'Oprettet', 'Skapad', 'Criado', '创建于', '作成日'],
  ['Ping', 'Ping', 'Ping', 'Пинг', 'Ping', 'Ping', 'Ping', '延迟', 'Ping'],
  ['Deine Gruppen', 'Your groups', 'Tus grupos', 'Ваши группы', 'Dine grupper', 'Dina grupper', 'Os seus grupos', '你的群组', 'あなたのグループ'],
  ['Ein freier Client für das TeamSpeak-3-Protokoll.', 'A free client for the TeamSpeak 3 protocol.', 'Un cliente libre para el protocolo TeamSpeak 3.', 'Свободный клиент для протокола TeamSpeak 3.', 'En fri klient til TeamSpeak 3-protokollen.', 'En fri klient för TeamSpeak 3-protokollet.', 'Um cliente livre para o protocolo TeamSpeak 3.', '一个免费的 TeamSpeak 3 协议客户端。', 'TeamSpeak 3 プロトコル用の無料クライアント。'],
  ['Tipp', 'Tip', 'Consejo', 'Совет', 'Tip', 'Tips', 'Dica', '提示', 'ヒント'],
  ['Tastenkürzel', 'Shortcuts', 'Atajos', 'Горячие клавиши', 'Genveje', 'Kortkommandon', 'Atalhos', '快捷键', 'ショートカット'],
  ['Strg+M Mikrofon, Strg+D Lautsprecher', 'Ctrl+M microphone, Ctrl+D speakers', 'Ctrl+M micrófono, Ctrl+D altavoces', 'Ctrl+M микрофон, Ctrl+D динамики', 'Ctrl+M mikrofon, Ctrl+D højttalere', 'Ctrl+M mikrofon, Ctrl+D högtalare', 'Ctrl+M microfone, Ctrl+D altifalantes', 'Ctrl+M 麦克风，Ctrl+D 扬声器', 'Ctrl+M マイク、Ctrl+D スピーカー'],
  ['Doppelklick auf einen Channel betritt ihn, Rechtsklick öffnet das Menü, Clients lassen sich per Drag & Drop verschieben, Strg+Klick wählt mehrere Clients.', 'Double-click a channel to join it, right-click opens the menu, drag & drop moves clients, Ctrl+click selects several clients.', 'Doble clic en un canal para entrar, clic derecho abre el menú, arrastrar y soltar mueve clientes, Ctrl+clic selecciona varios.', 'Двойной щелчок по каналу — войти, правый щелчок — меню, перетаскивание перемещает клиентов, Ctrl+щелчок выбирает нескольких.', 'Dobbeltklik på en kanal for at gå ind, højreklik åbner menuen, træk og slip flytter klienter, Ctrl+klik vælger flere.', 'Dubbelklicka på en kanal för att gå med, högerklick öppnar menyn, dra och släpp flyttar klienter, Ctrl+klick väljer flera.', 'Duplo clique num canal para entrar, clique direito abre o menu, arrastar e largar move clientes, Ctrl+clique seleciona vários.', '双击频道进入，右键打开菜单，拖放可移动客户端，Ctrl+单击可多选。', 'チャンネルをダブルクリックで参加、右クリックでメニュー、ドラッグ＆ドロップで移動、Ctrl+クリックで複数選択。'],
  // ---------------------------------------------------------------- chat
  ['Server', 'Server', 'Servidor', 'Сервер', 'Server', 'Server', 'Servidor', '服务器', 'サーバー'],
  ['Channel', 'Channel', 'Canal', 'Канал', 'Kanal', 'Kanal', 'Canal', '频道', 'チャンネル'],
  ['Nachricht an alle auf dem Server …', 'Message to everyone on the server …', 'Mensaje para todos en el servidor …', 'Сообщение всем на сервере …', 'Besked til alle på serveren …', 'Meddelande till alla på servern …', 'Mensagem para todos no servidor …', '发给服务器所有人的消息 …', 'サーバー全体へのメッセージ …'],
  ['Nachricht an deinen Channel …', 'Message to your channel …', 'Mensaje para tu canal …', 'Сообщение в ваш канал …', 'Besked til din kanal …', 'Meddelande till din kanal …', 'Mensagem para o seu canal …', '发给你频道的消息 …', 'チャンネルへのメッセージ …'],
  ['Schließen', 'Close', 'Cerrar', 'Закрыть', 'Luk', 'Stäng', 'Fechar', '关闭', '閉じる'],
  ['Tab schließen', 'Close tab', 'Cerrar pestaña', 'Закрыть вкладку', 'Luk fane', 'Stäng flik', 'Fechar separador', '关闭标签页', 'タブを閉じる'],
  ['Neue Verbindung', 'New connection', 'Nueva conexión', 'Новое подключение', 'Ny forbindelse', 'Ny anslutning', 'Nova ligação', '新连接', '新しい接続'],
  ['Willkommen bei RustSpeak. Verbinde dich über das Menü „Verbindungen“ oder wähle einen Favoriten.', 'Welcome to RustSpeak. Connect via the “Connections” menu or pick a bookmark.', 'Bienvenido a RustSpeak. Conéctate desde el menú «Conexiones» o elige un favorito.', 'Добро пожаловать в RustSpeak. Подключитесь через меню «Подключения» или выберите избранное.', 'Velkommen til RustSpeak. Forbind via menuen „Forbindelser“ eller vælg en favorit.', 'Välkommen till RustSpeak. Anslut via menyn ”Anslutningar” eller välj en favorit.', 'Bem-vindo ao RustSpeak. Ligue-se pelo menu «Conexões» ou escolha um favorito.', '欢迎使用 RustSpeak。通过“连接”菜单连接或选择一个收藏。', 'RustSpeak へようこそ。「接続」メニューから接続するか、ブックマークを選んでください。'],
  // ---------------------------------------------------------------- status bar
  ['Sprachaktivierung', 'Voice activation', 'Activación por voz', 'Активация голосом', 'Stemmeaktivering', 'Röstaktivering', 'Ativação por voz', '语音激活', '音声起動'],
  ['Sprachaktivierung (KI)', 'Voice activation (AI)', 'Activación por voz (IA)', 'Активация голосом (ИИ)', 'Stemmeaktivering (AI)', 'Röstaktivering (AI)', 'Ativação por voz (IA)', '语音激活（AI）', '音声起動（AI）'],
  ['Push-to-Talk', 'Push-to-talk', 'Pulsar para hablar', 'Нажми и говори', 'Tryk-for-at-tale', 'Tryck-för-att-tala', 'Premir para falar', '按键说话', 'プッシュトゥトーク'],
  ['Dauerhaft senden', 'Continuous transmission', 'Transmisión continua', 'Постоянная передача', 'Send altid', 'Sänd alltid', 'Transmissão contínua', '持续发送', '常時送信'],
  ['Mikrofonpegel', 'Microphone level', 'Nivel del micrófono', 'Уровень микрофона', 'Mikrofonniveau', 'Mikrofonnivå', 'Nível do microfone', '麦克风电平', 'マイクレベル'],
  // ---------------------------------------------------------------- connect dialog
  ['Serveradresse', 'Server address', 'Dirección del servidor', 'Адрес сервера', 'Serveradresse', 'Serveradress', 'Endereço do servidor', '服务器地址', 'サーバーアドレス'],
  ['Spitzname', 'Nickname', 'Apodo', 'Никнейм', 'Kaldenavn', 'Smeknamn', 'Alcunha', '昵称', 'ニックネーム'],
  ['Server-Passwort', 'Server password', 'Contraseña del servidor', 'Пароль сервера', 'Serveradgangskode', 'Serverlösenord', 'Palavra-passe do servidor', '服务器密码', 'サーバーパスワード'],
  ['Erweitert', 'Advanced', 'Avanzado', 'Дополнительно', 'Avanceret', 'Avancerat', 'Avançado', '高级', '詳細'],
  ['Standardchannel', 'Default channel', 'Canal predeterminado', 'Канал по умолчанию', 'Standardkanal', 'Standardkanal', 'Canal predefinido', '默认频道', 'デフォルトチャンネル'],
  ['Channel-Passwort', 'Channel password', 'Contraseña del canal', 'Пароль канала', 'Kanaladgangskode', 'Kanallösenord', 'Palavra-passe do canal', '频道密码', 'チャンネルパスワード'],
  ['In neuem Server-Tab öffnen', 'Open in new server tab', 'Abrir en nueva pestaña', 'Открыть в новой вкладке', 'Åbn i ny serverfane', 'Öppna i ny serverflik', 'Abrir num novo separador', '在新的服务器标签页中打开', '新しいサーバータブで開く'],
  ['Zu Favoriten hinzufügen', 'Add to bookmarks', 'Añadir a favoritos', 'Добавить в избранное', 'Tilføj til favoritter', 'Lägg till i favoriter', 'Adicionar aos favoritos', '添加到收藏夹', 'ブックマークに追加'],
  ['Abbrechen', 'Cancel', 'Cancelar', 'Отмена', 'Annuller', 'Avbryt', 'Cancelar', '取消', 'キャンセル'],
  ['z. B. 127.0.0.1 oder ts.example.org:9987', 'e.g. 127.0.0.1 or ts.example.org:9987', 'p. ej. 127.0.0.1 o ts.example.org:9987', 'напр. 127.0.0.1 или ts.example.org:9987', 'f.eks. 127.0.0.1 eller ts.example.org:9987', 't.ex. 127.0.0.1 eller ts.example.org:9987', 'p. ex. 127.0.0.1 ou ts.example.org:9987', '例如 127.0.0.1 或 ts.example.org:9987', '例: 127.0.0.1 または ts.example.org:9987'],
  ['Channelname oder /ID', 'Channel name or /ID', 'Nombre del canal o /ID', 'Имя канала или /ID', 'Kanalnavn eller /ID', 'Kanalnamn eller /ID', 'Nome do canal ou /ID', '频道名称或 /ID', 'チャンネル名または /ID'],
  ['Mit Server verbinden', 'Connect to server', 'Conectar al servidor', 'Подключиться к серверу', 'Forbind til server', 'Anslut till server', 'Ligar ao servidor', '连接到服务器', 'サーバーに接続'],
  ['Verbindung trennen', 'Disconnect', 'Desconectar', 'Отключиться', 'Afbryd forbindelse', 'Koppla från', 'Desligar', '断开连接', '切断'],
  ['Channel erstellen', 'Create channel', 'Crear canal', 'Создать канал', 'Opret kanal', 'Skapa kanal', 'Criar canal', '创建频道', 'チャンネルを作成'],
  // ---------------------------------------------------------------- dialogs
  ['OK', 'OK', 'Aceptar', 'OK', 'OK', 'OK', 'OK', '确定', 'OK'],
  ['Speichern', 'Save', 'Guardar', 'Сохранить', 'Gem', 'Spara', 'Guardar', '保存', '保存'],
  ['Erstellen', 'Create', 'Crear', 'Создать', 'Opret', 'Skapa', 'Criar', '创建', '作成'],
  ['Löschen', 'Delete', 'Eliminar', 'Удалить', 'Slet', 'Ta bort', 'Eliminar', '删除', '削除'],
  ['Entfernen', 'Remove', 'Quitar', 'Удалить', 'Fjern', 'Ta bort', 'Remover', '移除', '削除'],
  ['Hinzufügen', 'Add', 'Añadir', 'Добавить', 'Tilføj', 'Lägg till', 'Adicionar', '添加', '追加'],
  ['Übernehmen', 'Apply', 'Aplicar', 'Применить', 'Anvend', 'Verkställ', 'Aplicar', '应用', '適用'],
  ['Anwenden', 'Apply', 'Aplicar', 'Применить', 'Anvend', 'Verkställ', 'Aplicar', '应用', '適用'],
  ['Verwerfen', 'Discard', 'Descartar', 'Отменить', 'Kassér', 'Ignorera', 'Descartar', '放弃', '破棄'],
  ['Aktualisieren', 'Refresh', 'Actualizar', 'Обновить', 'Opdater', 'Uppdatera', 'Atualizar', '刷新', '更新'],
  ['Umbenennen', 'Rename', 'Renombrar', 'Переименовать', 'Omdøb', 'Byt namn', 'Renomear', '重命名', '名前を変更'],
  ['Kopieren', 'Copy', 'Copiar', 'Копировать', 'Kopiér', 'Kopiera', 'Copiar', '复制', 'コピー'],
  ['Kopiert', 'Copied', 'Copiado', 'Скопировано', 'Kopieret', 'Kopierat', 'Copiado', '已复制', 'コピーしました'],
  ['Name', 'Name', 'Nombre', 'Имя', 'Navn', 'Namn', 'Nome', '名称', '名前'],
  ['Thema', 'Topic', 'Tema', 'Тема', 'Emne', 'Ämne', 'Tema', '主题', 'トピック'],
  ['Beschreibung', 'Description', 'Descripción', 'Описание', 'Beskrivelse', 'Beskrivning', 'Descrição', '描述', '説明'],
  ['Beschreibung (BBCode erlaubt)', 'Description (BBCode allowed)', 'Descripción (se permite BBCode)', 'Описание (BBCode разрешён)', 'Beskrivelse (BBCode tilladt)', 'Beskrivning (BBCode tillåtet)', 'Descrição (BBCode permitido)', '描述（允许 BBCode）', '説明（BBCode 使用可）'],
  ['Passwort (optional)', 'Password (optional)', 'Contraseña (opcional)', 'Пароль (необязательно)', 'Adgangskode (valgfri)', 'Lösenord (valfritt)', 'Palavra-passe (opcional)', '密码（可选）', 'パスワード（任意）'],
  ['Neues Passwort (leer = unverändert)', 'New password (empty = unchanged)', 'Nueva contraseña (vacío = sin cambios)', 'Новый пароль (пусто = без изменений)', 'Ny adgangskode (tom = uændret)', 'Nytt lösenord (tomt = oförändrat)', 'Nova palavra-passe (vazio = sem alteração)', '新密码（留空则不变）', '新しいパスワード（空欄 = 変更なし）'],
  ['Passwort entfernen', 'Remove password', 'Quitar contraseña', 'Удалить пароль', 'Fjern adgangskode', 'Ta bort lösenord', 'Remover palavra-passe', '移除密码', 'パスワードを削除'],
  ['Channeltyp', 'Channel type', 'Tipo de canal', 'Тип канала', 'Kanaltype', 'Kanaltyp', 'Tipo de canal', '频道类型', 'チャンネルの種類'],
  ['Temporär (wird gelöscht, wenn leer)', 'Temporary (deleted when empty)', 'Temporal (se elimina al quedar vacío)', 'Временный (удаляется, когда пуст)', 'Midlertidig (slettes når tom)', 'Tillfällig (tas bort när tom)', 'Temporário (eliminado quando vazio)', '临时（为空时删除）', '一時（空になると削除）'],
  ['Semi-permanent (bis zum Serverneustart)', 'Semi-permanent (until server restart)', 'Semipermanente (hasta reiniciar el servidor)', 'Полупостоянный (до перезапуска сервера)', 'Semi-permanent (indtil servergenstart)', 'Semipermanent (till serveromstart)', 'Semipermanente (até reiniciar o servidor)', '半永久（直到服务器重启）', '半永続（サーバー再起動まで）'],
  ['Standardchannel (neue Clients landen hier)', 'Default channel (new clients land here)', 'Canal predeterminado (los nuevos clientes llegan aquí)', 'Канал по умолчанию (новые клиенты попадают сюда)', 'Standardkanal (nye klienter lander her)', 'Standardkanal (nya klienter hamnar här)', 'Canal predefinido (novos clientes chegam aqui)', '默认频道（新客户端进入此处）', 'デフォルトチャンネル（新規クライアントはここへ）'],
  ['Channel-Icon', 'Channel icon', 'Icono del canal', 'Значок канала', 'Kanalikon', 'Kanalikon', 'Ícone do canal', '频道图标', 'チャンネルアイコン'],
  ['Maximale Clients (-1 = unbegrenzt)', 'Max clients (-1 = unlimited)', 'Clientes máximos (-1 = ilimitado)', 'Макс. клиентов (-1 = без ограничений)', 'Maks. klienter (-1 = ubegrænset)', 'Max klienter (-1 = obegränsat)', 'Máx. clientes (-1 = ilimitado)', '最大客户端数（-1 = 无限）', '最大クライアント数（-1 = 無制限）'],
  ['Sprachqualität (Opus)', 'Voice quality (Opus)', 'Calidad de voz (Opus)', 'Качество голоса (Opus)', 'Stemmekvalitet (Opus)', 'Röstkvalitet (Opus)', 'Qualidade de voz (Opus)', '语音质量（Opus）', '音声品質（Opus）'],
  ['Benötigte Sprechkraft (0 = jeder darf sprechen)', 'Needed talk power (0 = everyone may talk)', 'Poder de habla necesario (0 = todos pueden hablar)', 'Нужная сила голоса (0 = говорить могут все)', 'Nødvendig taleret (0 = alle må tale)', 'Nödvändig talkraft (0 = alla får tala)', 'Poder de fala necessário (0 = todos podem falar)', '所需发言权（0 = 所有人可发言）', '必要な発言力（0 = 誰でも発言可）'],
  ['Auswählen …', 'Choose …', 'Elegir …', 'Выбрать …', 'Vælg …', 'Välj …', 'Escolher …', '选择 …', '選択 …'],
  ['kein Icon', 'no icon', 'sin icono', 'без значка', 'intet ikon', 'ingen ikon', 'sem ícone', '无图标', 'アイコンなし'],
  ['Kein Icon', 'No icon', 'Sin icono', 'Без значка', 'Intet ikon', 'Ingen ikon', 'Sem ícone', '无图标', 'アイコンなし'],
  ['Icon auswählen', 'Choose icon', 'Elegir icono', 'Выбрать значок', 'Vælg ikon', 'Välj ikon', 'Escolher ícone', '选择图标', 'アイコンを選択'],
  ['Integrierte Icons', 'Built-in icons', 'Iconos integrados', 'Встроенные значки', 'Indbyggede ikoner', 'Inbyggda ikoner', 'Ícones integrados', '内置图标', '内蔵アイコン'],
  ['Hochgeladene Icons', 'Uploaded icons', 'Iconos subidos', 'Загруженные значки', 'Uploadede ikoner', 'Uppladdade ikoner', 'Ícones carregados', '已上传图标', 'アップロード済みアイコン'],
  ['Bild hochladen …', 'Upload image …', 'Subir imagen …', 'Загрузить изображение …', 'Upload billede …', 'Ladda upp bild …', 'Carregar imagem …', '上传图片 …', '画像をアップロード …'],
  ['Noch keine eigenen Icons.', 'No own icons yet.', 'Aún no hay iconos propios.', 'Пока нет своих значков.', 'Ingen egne ikoner endnu.', 'Inga egna ikoner än.', 'Ainda sem ícones próprios.', '暂无自定义图标。', '独自アイコンはまだありません。'],
  ['Icon hochgeladen', 'Icon uploaded', 'Icono subido', 'Значок загружен', 'Ikon uploadet', 'Ikon uppladdad', 'Ícone carregado', '图标已上传', 'アイコンをアップロードしました'],
  ['Icons', 'Icons', 'Iconos', 'Значки', 'Ikoner', 'Ikoner', 'Ícones', '图标', 'アイコン'],
  ['Servername', 'Server name', 'Nombre del servidor', 'Имя сервера', 'Servernavn', 'Servernamn', 'Nome do servidor', '服务器名称', 'サーバー名'],
  ['Willkommensnachricht', 'Welcome message', 'Mensaje de bienvenida', 'Приветствие', 'Velkomstbesked', 'Välkomstmeddelande', 'Mensagem de boas-vindas', '欢迎消息', 'ウェルカムメッセージ'],
  ['Maximale Clients', 'Max clients', 'Clientes máximos', 'Макс. клиентов', 'Maks. klienter', 'Max klienter', 'Máx. clientes', '最大客户端数', '最大クライアント数'],
  ['Neues Serverpasswort (leer = unverändert)', 'New server password (empty = unchanged)', 'Nueva contraseña del servidor (vacío = sin cambios)', 'Новый пароль сервера (пусто = без изменений)', 'Ny serveradgangskode (tom = uændret)', 'Nytt serverlösenord (tomt = oförändrat)', 'Nova palavra-passe do servidor (vazio = sem alteração)', '新服务器密码（留空则不变）', '新しいサーバーパスワード（空欄 = 変更なし）'],
  ['Serverpasswort entfernen', 'Remove server password', 'Quitar contraseña del servidor', 'Удалить пароль сервера', 'Fjern serveradgangskode', 'Ta bort serverlösenord', 'Remover palavra-passe do servidor', '移除服务器密码', 'サーバーパスワードを削除'],
  ['Bildschirm teilen', 'Share screen', 'Compartir pantalla', 'Показать экран', 'Del skærm', 'Dela skärm', 'Partilhar ecrã', '共享屏幕', '画面を共有'],
  ['Bildschirm beenden', 'Stop screen', 'Detener pantalla', 'Остановить показ экрана', 'Stop skærm', 'Stoppa skärm', 'Parar ecrã', '停止共享屏幕', '画面共有を停止'],
  ['Webcam', 'Webcam', 'Cámara web', 'Веб-камера', 'Webcam', 'Webbkamera', 'Webcam', '摄像头', 'Webカメラ'],
  ['Webcam beenden', 'Stop webcam', 'Detener cámara', 'Выключить веб-камеру', 'Stop webcam', 'Stoppa webbkamera', 'Parar webcam', '关闭摄像头', 'Webカメラを停止'],
  ['Bildschirm', 'Screen', 'Pantalla', 'Экран', 'Skærm', 'Skärm', 'Ecrã', '屏幕', '画面'],
  ['Video-Einstellungen', 'Video settings', 'Ajustes de vídeo', 'Настройки видео', 'Videoindstillinger', 'Videoinställningar', 'Definições de vídeo', '视频设置', 'ビデオ設定'],
  ['Channel-Ansicht', 'Channel view', 'Vista del canal', 'Вид канала', 'Kanalvisning', 'Kanalvy', 'Vista do canal', '频道视图', 'チャンネルビュー'],
  ['Channel-Ansicht schließen', 'Close channel view', 'Cerrar vista del canal', 'Закрыть вид канала', 'Luk kanalvisning', 'Stäng kanalvy', 'Fechar vista do canal', '关闭频道视图', 'チャンネルビューを閉じる'],
  ['Channel-Ansicht (Video) öffnen', 'Open channel view (video)', 'Abrir vista del canal (vídeo)', 'Открыть вид канала (видео)', 'Åbn kanalvisning (video)', 'Öppna kanalvy (video)', 'Abrir vista do canal (vídeo)', '打开频道视图（视频）', 'チャンネルビューを開く（ビデオ）'],
  ['Hervorheben', 'Spotlight', 'Destacar', 'Выделить', 'Fremhæv', 'Framhäv', 'Destacar', '聚焦', '強調表示'],
  ['Vollbild', 'Fullscreen', 'Pantalla completa', 'Полный экран', 'Fuld skærm', 'Helskärm', 'Ecrã inteiro', '全屏', '全画面'],
  ['Ausblenden', 'Hide', 'Ocultar', 'Скрыть', 'Skjul', 'Dölj', 'Ocultar', '隐藏', '非表示'],
  ['Ansehen', 'Watch', 'Ver', 'Смотреть', 'Se', 'Titta', 'Ver', '观看', '視聴'],
  ['Kein Recht zum Ansehen', 'Not allowed to watch', 'Sin permiso para ver', 'Нет права на просмотр', 'Ingen ret til at se', 'Ingen rätt att titta', 'Sem permissão para ver', '无观看权限', '視聴する権限がありません'],
  ['Kein Recht zum Übertragen', 'Not allowed to stream', 'Sin permiso para transmitir', 'Нет права на трансляцию', 'Ingen ret til at streame', 'Ingen rätt att streama', 'Sem permissão para transmitir', '无直播权限', '配信する権限がありません'],
  ['Niemand überträgt gerade. Teile deinen Bildschirm oder deine Webcam mit dem Channel.', 'Nobody is streaming right now. Share your screen or webcam with the channel.', 'Nadie está transmitiendo. Comparte tu pantalla o tu cámara con el canal.', 'Сейчас никто не транслирует. Покажите каналу свой экран или веб-камеру.', 'Ingen streamer lige nu. Del din skærm eller dit webcam med kanalen.', 'Ingen streamar just nu. Dela din skärm eller webbkamera med kanalen.', 'Ninguém está a transmitir. Partilhe o seu ecrã ou webcam com o canal.', '目前没有人在直播。与频道共享你的屏幕或摄像头。', '現在配信中の人はいません。画面またはWebカメラをチャンネルと共有しましょう。'],
  ['Qualität', 'Quality', 'Calidad', 'Качество', 'Kvalitet', 'Kvalitet', 'Qualidade', '画质', '画質'],
  ['Qualität beim Übertragen', 'Streaming quality', 'Calidad de transmisión', 'Качество трансляции', 'Streamingkvalitet', 'Streamingkvalitet', 'Qualidade de transmissão', '直播画质', '配信画質'],
  ['Übertragungen in der Channel-Ansicht automatisch ansehen', 'Automatically watch streams in the channel view', 'Ver transmisiones automáticamente en la vista del canal', 'Автоматически смотреть трансляции в виде канала', 'Se streams automatisk i kanalvisningen', 'Titta automatiskt på streams i kanalvyn', 'Ver transmissões automaticamente na vista do canal', '在频道视图中自动观看直播', 'チャンネルビューで配信を自動的に視聴'],
  ['startet …', 'starting …', 'iniciando …', 'запуск …', 'starter …', 'startar …', 'a iniciar …', '正在启动 …', '開始中 …'],
  ['Dir fehlt das Recht, im Channel zu übertragen.', 'You are not allowed to stream in this channel.', 'No tienes permiso para transmitir en este canal.', 'У вас нет права вести трансляцию в этом канале.', 'Du har ikke ret til at streame i kanalen.', 'Du har inte rätt att streama i kanalen.', 'Não tem permissão para transmitir neste canal.', '你没有在此频道直播的权限。', 'このチャンネルで配信する権限がありません。'],
  ['Dir fehlt das Recht, im Channel zu übertragen (b_client_video_stream).', 'You are not allowed to stream in this channel (b_client_video_stream).', 'No tienes permiso para transmitir en este canal (b_client_video_stream).', 'У вас нет права вести трансляцию в этом канале (b_client_video_stream).', 'Du har ikke ret til at streame i kanalen (b_client_video_stream).', 'Du har inte rätt att streama i kanalen (b_client_video_stream).', 'Não tem permissão para transmitir neste canal (b_client_video_stream).', '你没有在此频道直播的权限（b_client_video_stream）。', 'このチャンネルで配信する権限がありません（b_client_video_stream）。'],
  ['Bildschirm-Übertragung wurde beendet.', 'Screen sharing has ended.', 'La transmisión de pantalla ha terminado.', 'Показ экрана завершён.', 'Skærmdeling er afsluttet.', 'Skärmdelningen har avslutats.', 'A partilha de ecrã terminou.', '屏幕共享已结束。', '画面共有が終了しました。'],
  ['Webcam-Übertragung wurde beendet.', 'Webcam stream has ended.', 'La transmisión de la cámara ha terminado.', 'Трансляция веб-камеры завершена.', 'Webcam-streamen er afsluttet.', 'Webbkamerasändningen har avslutats.', 'A transmissão da webcam terminou.', '摄像头直播已结束。', 'Webカメラ配信が終了しました。'],
  ['Der Server unterstützt keine Video-Übertragung.', 'The server does not support video streaming.', 'El servidor no admite transmisión de vídeo.', 'Сервер не поддерживает видеотрансляции.', 'Serveren understøtter ikke videostreaming.', 'Servern stöder inte videostreaming.', 'O servidor não suporta transmissão de vídeo.', '服务器不支持视频直播。', 'サーバーはビデオ配信に対応していません。'],
  ['Video-Relay nicht erreichbar.', 'Video relay not reachable.', 'Relé de vídeo inaccesible.', 'Видеоретранслятор недоступен.', 'Video-relæ kan ikke nås.', 'Videoreläet kan inte nås.', 'Relé de vídeo inacessível.', '无法连接视频中继。', 'ビデオリレーに接続できません。'],
  ['Video-Relay antwortet nicht.', 'Video relay is not responding.', 'El relé de vídeo no responde.', 'Видеоретранслятор не отвечает.', 'Video-relæet svarer ikke.', 'Videoreläet svarar inte.', 'O relé de vídeo não responde.', '视频中继无响应。', 'ビデオリレーが応答しません。'],
  ['Bildschirm wird übertragen', 'Sharing screen', 'Compartiendo pantalla', 'Идёт показ экрана', 'Deler skærm', 'Delar skärm', 'A partilhar ecrã', '正在共享屏幕', '画面を共有中'],
  ['Webcam wird übertragen', 'Webcam is live', 'Cámara en directo', 'Веб-камера в эфире', 'Webcam er live', 'Webbkamera sänds', 'Webcam em direto', '摄像头直播中', 'Webカメラ配信中'],
  ['Bildschirm und Webcam übertragen', 'Stream screen and webcam', 'Transmitir pantalla y cámara', 'Транслировать экран и веб-камеру', 'Stream skærm og webcam', 'Streama skärm och webbkamera', 'Transmitir ecrã e webcam', '直播屏幕和摄像头', '画面とWebカメラを配信'],
  ['in der Channel-Ansicht den Bildschirm oder die Webcam teilen und Übertragungen ansehen', 'share your screen or webcam in the channel view and watch streams', 'compartir pantalla o cámara en la vista del canal y ver transmisiones', 'показывать экран или веб-камеру в виде канала и смотреть трансляции', 'del skærm eller webcam i kanalvisningen og se streams', 'dela skärm eller webbkamera i kanalvyn och titta på streams', 'partilhar ecrã ou webcam na vista do canal e ver transmissões', '在频道视图中共享屏幕或摄像头并观看直播', 'チャンネルビューで画面やWebカメラを共有し、配信を視聴'],
  ['Bildschirm oder Webcam im Channel übertragen', 'Stream screen or webcam in the channel', 'Transmitir pantalla o cámara en el canal', 'Транслировать экран или веб-камеру в канале', 'Stream skærm eller webcam i kanalen', 'Streama skärm eller webbkamera i kanalen', 'Transmitir ecrã ou webcam no canal', '在频道中直播屏幕或摄像头', 'チャンネルで画面またはWebカメラを配信'],
  ['Video-Übertragungen im Channel ansehen', 'Watch video streams in the channel', 'Ver transmisiones de vídeo en el canal', 'Смотреть видеотрансляции в канале', 'Se videostreams i kanalen', 'Titta på videostreams i kanalen', 'Ver transmissões de vídeo no canal', '观看频道中的视频直播', 'チャンネルのビデオ配信を視聴'],
  ['Video-Verbindung', 'Video connection', 'Conexión de vídeo', 'Видеосоединение', 'Videoforbindelse', 'Videoanslutning', 'Ligação de vídeo', '视频连接', 'ビデオ接続'],
  ['Kein passender Video-Encoder gefunden.', 'No suitable video encoder found.', 'No se encontró un codificador de vídeo adecuado.', 'Подходящий видеокодер не найден.', 'Ingen egnet videoencoder fundet.', 'Ingen lämplig videokodare hittades.', 'Nenhum codificador de vídeo adequado encontrado.', '未找到合适的视频编码器。', '適切なビデオエンコーダーが見つかりません。'],
  ['Diese WebView unterstützt keine Video-Kodierung (WebCodecs).', 'This WebView does not support video encoding (WebCodecs).', 'Este WebView no admite codificación de vídeo (WebCodecs).', 'Этот WebView не поддерживает кодирование видео (WebCodecs).', 'Denne WebView understøtter ikke videokodning (WebCodecs).', 'Denna WebView stöder inte videokodning (WebCodecs).', 'Este WebView não suporta codificação de vídeo (WebCodecs).', '此 WebView 不支持视频编码（WebCodecs）。', 'このWebViewはビデオエンコード（WebCodecs）に対応していません。'],
  ['Video-Anmeldung abgelehnt.', 'Video sign-in rejected.', 'Inicio de sesión de vídeo rechazado.', 'Вход в видео отклонён.', 'Video-login afvist.', 'Videoinloggning avvisad.', 'Início de sessão de vídeo rejeitado.', '视频登录被拒绝。', 'ビデオのサインインが拒否されました。'],
  ['480p · 30 FPS (sparsam)', '480p · 30 FPS (data saver)', '480p · 30 FPS (ahorro)', '480p · 30 FPS (экономно)', '480p · 30 FPS (sparsom)', '480p · 30 FPS (snål)', '480p · 30 FPS (poupança)', '480p · 30 FPS（省流）', '480p · 30 FPS（節約）'],
  ['Bots verwalten …', 'Manage bots …', 'Gestionar bots …', 'Управление ботами …', 'Administrer bots …', 'Hantera botar …', 'Gerir bots …', '管理机器人 …', 'ボットを管理 …'],
  ['Bots', 'Bots', 'Bots', 'Боты', 'Bots', 'Botar', 'Bots', '机器人', 'ボット'],
  ['Bot anlegen …', 'Create bot …', 'Crear bot …', 'Создать бота …', 'Opret bot …', 'Skapa bot …', 'Criar bot …', '创建机器人 …', 'ボットを作成 …'],
  ['Bot anlegen', 'Create bot', 'Crear bot', 'Создать бота', 'Opret bot', 'Skapa bot', 'Criar bot', '创建机器人', 'ボットを作成'],
  ['Anlegen', 'Create', 'Crear', 'Создать', 'Opret', 'Skapa', 'Criar', '创建', '作成'],
  ['Name des Bots (wird als Spitzname verwendet)', 'Bot name (used as nickname)', 'Nombre del bot (se usa como apodo)', 'Имя бота (используется как ник)', 'Botnavn (bruges som kaldenavn)', 'Botnamn (används som smeknamn)', 'Nome do bot (usado como alcunha)', '机器人名称（用作昵称）', 'ボット名（ニックネームとして使用）'],
  ['Noch keine Bots angelegt.', 'No bots created yet.', 'Aún no hay bots.', 'Боты ещё не созданы.', 'Ingen bots oprettet endnu.', 'Inga botar skapade ännu.', 'Ainda não há bots.', '尚未创建机器人。', 'まだボットはありません。'],
  ['Bot-Schlüssel', 'Bot key', 'Clave del bot', 'Ключ бота', 'Botnøgle', 'Botnyckel', 'Chave do bot', '机器人密钥', 'ボットキー'],
  ['Bot-Schlüssel kopiert.', 'Bot key copied.', 'Clave del bot copiada.', 'Ключ бота скопирован.', 'Botnøgle kopieret.', 'Botnyckel kopierad.', 'Chave do bot copiada.', '机器人密钥已复制。', 'ボットキーをコピーしました。'],
  ['Bot-Schlüssel verwalten', 'Manage bot keys', 'Gestionar claves de bots', 'Управление ключами ботов', 'Administrer botnøgler', 'Hantera botnycklar', 'Gerir chaves de bots', '管理机器人密钥', 'ボットキーを管理'],
  ['online', 'online', 'en línea', 'в сети', 'online', 'online', 'online', '在线', 'オンライン'],
  ['Bot', 'Bot', 'Bot', 'Бот', 'Bot', 'Bot', 'Bot', '机器人', 'ボット'],
  ['Du teilst deinen Bildschirm.', 'You are sharing your screen.', 'Estás compartiendo tu pantalla.', 'Вы показываете свой экран.', 'Du deler din skærm.', 'Du delar din skärm.', 'Está a partilhar o seu ecrã.', '你正在共享屏幕。', '画面を共有しています。'],
  ['Vorschau anzeigen', 'Show preview', 'Mostrar vista previa', 'Показать превью', 'Vis forhåndsvisning', 'Visa förhandsvisning', 'Mostrar pré-visualização', '显示预览', 'プレビューを表示'],
  ['Vorschau ausblenden', 'Hide preview', 'Ocultar vista previa', 'Скрыть превью', 'Skjul forhåndsvisning', 'Dölj förhandsvisning', 'Ocultar pré-visualização', '隐藏预览', 'プレビューを隠す'],
  ['Teilen', 'Share', 'Compartir', 'Показать', 'Del', 'Dela', 'Partilhar', '共享', '共有'],
  ['Alle', 'All', 'Todo', 'Все', 'Alle', 'Alla', 'Todos', '全部', 'すべて'],
  ['Bildschirme', 'Screens', 'Pantallas', 'Экраны', 'Skærme', 'Skärmar', 'Ecrãs', '屏幕', '画面'],
  ['Fenster', 'Windows', 'Ventanas', 'Окна', 'Vinduer', 'Fönster', 'Janelas', '窗口', 'ウィンドウ'],
  ['Quellen werden geladen …', 'Loading sources …', 'Cargando fuentes …', 'Загрузка источников …', 'Indlæser kilder …', 'Läser in källor …', 'A carregar fontes …', '正在加载来源 …', 'ソースを読み込み中 …'],
  ['Keine Bildschirme gefunden.', 'No screens found.', 'No se encontraron pantallas.', 'Экраны не найдены.', 'Ingen skærme fundet.', 'Inga skärmar hittades.', 'Nenhum ecrã encontrado.', '未找到屏幕。', '画面が見つかりません。'],
  ['Keine Fenster gefunden.', 'No windows found.', 'No se encontraron ventanas.', 'Окна не найдены.', 'Ingen vinduer fundet.', 'Inga fönster hittades.', 'Nenhuma janela encontrada.', '未找到窗口。', 'ウィンドウが見つかりません。'],
  ['Hauptbildschirm', 'Primary screen', 'Pantalla principal', 'Основной экран', 'Primær skærm', 'Huvudskärm', 'Ecrã principal', '主屏幕', 'メイン画面'],
  ['Bildschirmübertragung beenden', 'Stop screen share', 'Dejar de compartir pantalla', 'Остановить показ экрана', 'Stop skærmdeling', 'Sluta dela skärm', 'Parar partilha de ecrã', '停止共享屏幕', '画面共有を停止'],
  ['Beenden', 'Stop', 'Detener', 'Остановить', 'Stop', 'Stoppa', 'Parar', '停止', '停止'],
  ['Alle Zuschauer im Channel sehen deinen Bildschirm danach nicht mehr.', 'Viewers in the channel will no longer see your screen.', 'Los espectadores del canal dejarán de ver tu pantalla.', 'Зрители в канале больше не увидят ваш экран.', 'Seerne i kanalen kan derefter ikke længere se din skærm.', 'Tittarna i kanalen ser sedan inte längre din skärm.', 'Os espectadores do canal deixam de ver o seu ecrã.', '频道中的观众将不再看到你的屏幕。', 'チャンネルの視聴者はあなたの画面を見られなくなります。'],
  ['Das geteilte Fenster wurde geschlossen.', 'The shared window was closed.', 'Se cerró la ventana compartida.', 'Показываемое окно было закрыто.', 'Det delte vindue blev lukket.', 'Det delade fönstret stängdes.', 'A janela partilhada foi fechada.', '共享的窗口已关闭。', '共有中のウィンドウが閉じられました。'],
  ['Soundpack', 'Sound pack', 'Paquete de sonidos', 'Набор звуков', 'Lydpakke', 'Ljudpaket', 'Pacote de sons', '音效包', 'サウンドパック'],
  ['Blockieren', 'Block', 'Bloquear', 'Заблокировать', 'Bloker', 'Blockera', 'Bloquear', '屏蔽', 'ブロック'],
  ['Blockierung aufheben', 'Unblock', 'Desbloquear', 'Разблокировать', 'Fjern blokering', 'Avblockera', 'Desbloquear', '取消屏蔽', 'ブロック解除'],
  ['Blockiert', 'Blocked', 'Bloqueado', 'Заблокирован', 'Blokeret', 'Blockerad', 'Bloqueado', '已屏蔽', 'ブロック中'],
  ['Server-Banner', 'Server banner', 'Banner del servidor', 'Баннер сервера', 'Serverbanner', 'Serverbanner', 'Banner do servidor', '服务器横幅', 'サーバーバナー'],
  ['Das Bild wird über einen externen Link geladen (http:// oder https://).', 'The image is loaded from an external link (http:// or https://).', 'La imagen se carga desde un enlace externo (http:// o https://).', 'Изображение загружается по внешней ссылке (http:// или https://).', 'Billedet hentes via et eksternt link (http:// eller https://).', 'Bilden laddas från en extern länk (http:// eller https://).', 'A imagem é carregada a partir de uma ligação externa (http:// ou https://).', '图片通过外部链接加载（http:// 或 https://）。', '画像は外部リンクから読み込まれます（http:// または https://）。'],
  ['Bild konnte nicht geladen werden', 'Image could not be loaded', 'No se pudo cargar la imagen', 'Не удалось загрузить изображение', 'Billedet kunne ikke indlæses', 'Bilden kunde inte laddas', 'Não foi possível carregar a imagem', '无法加载图片', '画像を読み込めませんでした'],
  ['Nur http:// oder https:// Links', 'Only http:// or https:// links', 'Solo enlaces http:// o https://', 'Только ссылки http:// или https://', 'Kun http:// eller https:// links', 'Endast http:// eller https://-länkar', 'Apenas ligações http:// ou https://', '仅限 http:// 或 https:// 链接', 'http:// または https:// のリンクのみ'],
  ['Banner wird entfernt', 'Banner will be removed', 'El banner se quitará', 'Баннер будет удалён', 'Banneret fjernes', 'Bannern tas bort', 'O banner será removido', '横幅将被移除', 'バナーは削除されます'],
  ['Banner-Bild und Link müssen mit http:// oder https:// beginnen.', 'Banner image and link must start with http:// or https://.', 'La imagen y el enlace del banner deben empezar por http:// o https://.', 'Изображение и ссылка баннера должны начинаться с http:// или https://.', 'Bannerbillede og link skal starte med http:// eller https://.', 'Bannerbild och länk måste börja med http:// eller https://.', 'A imagem e a ligação do banner devem começar por http:// ou https://.', '横幅图片和链接必须以 http:// 或 https:// 开头。', 'バナー画像とリンクは http:// または https:// で始まる必要があります。'],
  ['Banner-Bild (URL)', 'Banner image (URL)', 'Imagen del banner (URL)', 'Изображение баннера (URL)', 'Bannerbillede (URL)', 'Bannerbild (URL)', 'Imagem do banner (URL)', '横幅图片（URL）', 'バナー画像（URL）'],
  ['Banner entfernen', 'Remove banner', 'Quitar banner', 'Удалить баннер', 'Fjern banner', 'Ta bort banner', 'Remover banner', '移除横幅', 'バナーを削除'],
  ['Link beim Klick auf das Banner', 'Link when clicking the banner', 'Enlace al hacer clic en el banner', 'Ссылка при клике на баннер', 'Link ved klik på banneret', 'Länk vid klick på bannern', 'Ligação ao clicar no banner', '点击横幅时的链接', 'バナークリック時のリンク'],
  ['Anzeige', 'Display', 'Visualización', 'Отображение', 'Visning', 'Visning', 'Apresentação', '显示', '表示'],
  ['Originalgröße', 'Original size', 'Tamaño original', 'Исходный размер', 'Originalstørrelse', 'Originalstorlek', 'Tamanho original', '原始大小', '元のサイズ'],
  ['An Breite anpassen (verzerren)', 'Fit width (stretch)', 'Ajustar al ancho (estirar)', 'По ширине (растянуть)', 'Tilpas bredde (stræk)', 'Anpassa bredd (sträck)', 'Ajustar à largura (esticar)', '适应宽度（拉伸）', '幅に合わせる（引き伸ばし）'],
  ['An Breite anpassen (Seitenverhältnis behalten)', 'Fit width (keep aspect ratio)', 'Ajustar al ancho (mantener proporción)', 'По ширине (сохранить пропорции)', 'Tilpas bredde (bevar forhold)', 'Anpassa bredd (behåll proportioner)', 'Ajustar à largura (manter proporção)', '适应宽度（保持比例）', '幅に合わせる（比率を維持）'],
  ['Grund', 'Reason', 'Motivo', 'Причина', 'Årsag', 'Anledning', 'Motivo', '原因', '理由'],
  ['Dauer', 'Duration', 'Duración', 'Длительность', 'Varighed', 'Varaktighet', 'Duração', '时长', '期間'],
  ['10 Minuten', '10 minutes', '10 minutos', '10 минут', '10 minutter', '10 minuter', '10 minutos', '10 分钟', '10分'],
  ['1 Stunde', '1 hour', '1 hora', '1 час', '1 time', '1 timme', '1 hora', '1 小时', '1時間'],
  ['1 Tag', '1 day', '1 día', '1 день', '1 dag', '1 dag', '1 dia', '1 天', '1日'],
  ['1 Woche', '1 week', '1 semana', '1 неделя', '1 uge', '1 vecka', '1 semana', '1 周', '1週間'],
  ['30 Tage', '30 days', '30 días', '30 дней', '30 dage', '30 dagar', '30 dias', '30 天', '30日'],
  ['Bannen', 'Ban', 'Banear', 'Забанить', 'Ban', 'Bannlys', 'Banir', '封禁', 'BAN'],
  ['Werfen', 'Kick', 'Expulsar', 'Выгнать', 'Smid ud', 'Sparka', 'Expulsar', '踢出', 'キック'],
  ['Aufheben', 'Lift', 'Levantar', 'Снять', 'Ophæv', 'Häv', 'Levantar', '解除', '解除'],
  ['Bannliste', 'Ban list', 'Lista de baneos', 'Список банов', 'Banliste', 'Bannlista', 'Lista de banimentos', '封禁列表', 'BANリスト'],
  ['Keine aktiven Banns.', 'No active bans.', 'No hay baneos activos.', 'Нет активных банов.', 'Ingen aktive bans.', 'Inga aktiva bannlysningar.', 'Sem banimentos ativos.', '没有有效的封禁。', '有効なBANはありません。'],
  ['permanent', 'permanent', 'permanente', 'навсегда', 'permanent', 'permanent', 'permanente', '永久', '永久'],
  ['Von', 'By', 'Por', 'Кем', 'Af', 'Av', 'Por', '执行者', '実行者'],
  ['Schlüssel', 'Key', 'Clave', 'Ключ', 'Nøgle', 'Nyckel', 'Chave', '密钥', 'キー'],
  ['Gruppe', 'Group', 'Grupo', 'Группа', 'Gruppe', 'Grupp', 'Grupo', '群组', 'グループ'],
  ['Verwenden', 'Use', 'Usar', 'Использовать', 'Brug', 'Använd', 'Usar', '使用', '使用'],
  ['Berechtigungsschlüssel', 'Privilege keys', 'Claves de privilegio', 'Ключи привилегий', 'Rettighedsnøgler', 'Behörighetsnycklar', 'Chaves de privilégio', '权限密钥', '権限キー'],
  ['Keine offenen Schlüssel.', 'No open keys.', 'No hay claves abiertas.', 'Нет открытых ключей.', 'Ingen åbne nøgler.', 'Inga öppna nycklar.', 'Sem chaves abertas.', '没有未使用的密钥。', '未使用のキーはありません。'],
  ['Schlüssel erstellt', 'Key created', 'Clave creada', 'Ключ создан', 'Nøgle oprettet', 'Nyckel skapad', 'Chave criada', '密钥已创建', 'キーを作成しました'],
  ['Angestupst', 'Poked', 'Te dieron un toque', 'Вас ткнули', 'Prikket', 'Petad', 'Cutucado', '被戳了', 'つつかれました'],
  ['Antworten', 'Reply', 'Responder', 'Ответить', 'Svar', 'Svara', 'Responder', '回复', '返信'],
  ['Neuer Spitzname', 'New nickname', 'Nuevo apodo', 'Новый никнейм', 'Nyt kaldenavn', 'Nytt smeknamn', 'Nova alcunha', '新昵称', '新しいニックネーム'],
  ['Ändern', 'Change', 'Cambiar', 'Изменить', 'Skift', 'Ändra', 'Alterar', '更改', '変更'],
  ['Spitzname ändern', 'Change nickname', 'Cambiar apodo', 'Изменить никнейм', 'Skift kaldenavn', 'Byt smeknamn', 'Alterar alcunha', '更改昵称', 'ニックネームを変更'],
  ['Beschreibung ändern', 'Change description', 'Cambiar descripción', 'Изменить описание', 'Skift beskrivelse', 'Ändra beskrivning', 'Alterar descrição', '更改描述', '説明を変更'],
  ['Abwesenheitsnachricht (optional)', 'Away message (optional)', 'Mensaje de ausencia (opcional)', 'Сообщение об отсутствии (необязательно)', 'Fraværsbesked (valgfri)', 'Bortameddelande (valfritt)', 'Mensagem de ausência (opcional)', '离开消息（可选）', '離席メッセージ（任意）'],
  ['Abwesend setzen', 'Set away', 'Marcar ausente', 'Отметить отсутствие', 'Sæt som væk', 'Sätt som borta', 'Marcar ausente', '设为离开', '離席にする'],
  ['Kanal-Passwort', 'Channel password', 'Contraseña del canal', 'Пароль канала', 'Kanaladgangskode', 'Kanallösenord', 'Palavra-passe do canal', '频道密码', 'チャンネルパスワード'],
  ['Online-Client', 'Online client', 'Cliente conectado', 'Клиент онлайн', 'Online-klient', 'Ansluten klient', 'Cliente online', '在线客户端', 'オンラインのクライアント'],
  ['oder Datenbank-ID', 'or database ID', 'o ID de base de datos', 'или ID в базе данных', 'eller database-ID', 'eller databas-ID', 'ou ID da base de dados', '或数据库 ID', 'またはデータベースID'],
  ['Mitglied hinzufügen', 'Add member', 'Añadir miembro', 'Добавить участника', 'Tilføj medlem', 'Lägg till medlem', 'Adicionar membro', '添加成员', 'メンバーを追加'],
  ['Neue Gruppe', 'New group', 'Nuevo grupo', 'Новая группа', 'Ny gruppe', 'Ny grupp', 'Novo grupo', '新群组', '新しいグループ'],
  ['Neuer Name', 'New name', 'Nuevo nombre', 'Новое имя', 'Nyt navn', 'Nytt namn', 'Novo nome', '新名称', '新しい名前'],
  ['Keine Mitglieder.', 'No members.', 'Sin miembros.', 'Нет участников.', 'Ingen medlemmer.', 'Inga medlemmar.', 'Sem membros.', '没有成员。', 'メンバーはいません。'],
  ['Favorit gespeichert', 'Bookmark saved', 'Favorito guardado', 'Избранное сохранено', 'Favorit gemt', 'Favorit sparad', 'Favorito guardado', '收藏已保存', 'ブックマークを保存しました'],
  ['Adresse', 'Address', 'Dirección', 'Адрес', 'Adresse', 'Adress', 'Endereço', '地址', 'アドレス'],
  ['Art', 'Kind', 'Tipo', 'Вид', 'Type', 'Typ', 'Tipo', '类型', '種類'],
  ['Zeichen / Text', 'Character / text', 'Carácter / texto', 'Символ / текст', 'Tegn / tekst', 'Tecken / text', 'Carácter / texto', '字符 / 文本', '文字 / テキスト'],
  // ---------------------------------------------------------------- connection info
  ['Clientname', 'Client name', 'Nombre del cliente', 'Имя клиента', 'Klientnavn', 'Klientnamn', 'Nome do cliente', '客户端名称', 'クライアント名'],
  ['Verbindungsdauer', 'Connection time', 'Tiempo de conexión', 'Время соединения', 'Forbindelsestid', 'Anslutningstid', 'Tempo de ligação', '连接时长', '接続時間'],
  ['Nicht geredet seit', 'Not talked for', 'Sin hablar desde', 'Не говорил', 'Ikke talt i', 'Inte pratat på', 'Sem falar há', '未发言时长', '最終発言から'],
  ['hat noch nicht geredet', 'has not talked yet', 'aún no ha hablado', 'ещё не говорил', 'har ikke talt endnu', 'har inte pratat än', 'ainda não falou', '尚未发言', 'まだ発言していません'],
  ['Clientadresse', 'Client address', 'Dirección del cliente', 'Адрес клиента', 'Klientadresse', 'Klientadress', 'Endereço do cliente', '客户端地址', 'クライアントアドレス'],
  ['verborgen (Recht fehlt)', 'hidden (missing permission)', 'oculta (falta permiso)', 'скрыт (нет права)', 'skjult (mangler rettighed)', 'dold (behörighet saknas)', 'oculto (falta permissão)', '隐藏（缺少权限）', '非表示（権限なし）'],
  ['Eingehend (Server → Client)', 'Incoming (server → client)', 'Entrante (servidor → cliente)', 'Входящий (сервер → клиент)', 'Indgående (server → klient)', 'Inkommande (server → klient)', 'Entrada (servidor → cliente)', '入站（服务器 → 客户端）', '受信（サーバー → クライアント）'],
  ['Ausgehend (Client → Server)', 'Outgoing (client → server)', 'Saliente (cliente → servidor)', 'Исходящий (клиент → сервер)', 'Udgående (klient → server)', 'Utgående (klient → server)', 'Saída (cliente → servidor)', '出站（客户端 → 服务器）', '送信（クライアント → サーバー）'],
  ['Paketverlust', 'Packet loss', 'Pérdida de paquetes', 'Потеря пакетов', 'Pakketab', 'Paketförlust', 'Perda de pacotes', '丢包', 'パケットロス'],
  ['Übertragene Pakete', 'Packets transferred', 'Paquetes transferidos', 'Передано пакетов', 'Overførte pakker', 'Överförda paket', 'Pacotes transferidos', '已传输数据包', '転送パケット'],
  ['Übertragene Bytes', 'Bytes transferred', 'Bytes transferidos', 'Передано байт', 'Overførte bytes', 'Överförda byte', 'Bytes transferidos', '已传输字节', '転送バイト'],
  ['Bandbreite letzte Sekunde', 'Bandwidth last second', 'Ancho de banda último segundo', 'Пропускная способность за секунду', 'Båndbredde sidste sekund', 'Bandbredd senaste sekunden', 'Largura de banda último segundo', '最近一秒带宽', '直近1秒の帯域'],
  ['Bandbreite letzte Minute', 'Bandwidth last minute', 'Ancho de banda último minuto', 'Пропускная способность за минуту', 'Båndbredde sidste minut', 'Bandbredd senaste minuten', 'Largura de banda último minuto', '最近一分钟带宽', '直近1分の帯域'],
  ['Dateitransfer-Bandbreite', 'File transfer bandwidth', 'Ancho de banda de transferencia', 'Полоса передачи файлов', 'Filoverførsels-båndbredde', 'Filöverföringsbandbredd', 'Largura de banda de transferência', '文件传输带宽', 'ファイル転送帯域'],
  ['Sprache', 'Speech', 'Voz', 'Голос', 'Tale', 'Tal', 'Voz', '语音', '音声'],
  ['Keepalive', 'Keepalive', 'Keepalive', 'Keepalive', 'Keepalive', 'Keepalive', 'Keepalive', '保活', 'キープアライブ'],
  ['Steuerung', 'Control', 'Control', 'Управление', 'Kontrol', 'Styrning', 'Controlo', '控制', '制御'],
  ['Gesamt', 'Total', 'Total', 'Всего', 'I alt', 'Totalt', 'Total', '总计', '合計'],
  ['Lade …', 'Loading …', 'Cargando …', 'Загрузка …', 'Indlæser …', 'Laddar …', 'A carregar …', '加载中 …', '読み込み中 …'],
  // ---------------------------------------------------------------- settings window
  ['Optionen', 'Options', 'Opciones', 'Параметры', 'Indstillinger', 'Alternativ', 'Opções', '选项', 'オプション'],
  ['Anwendung', 'Application', 'Aplicación', 'Приложение', 'Program', 'Program', 'Aplicação', '应用程序', 'アプリケーション'],
  ['Allgemeine Anwendungseinstellungen', 'General application settings', 'Ajustes generales de la aplicación', 'Общие настройки приложения', 'Generelle programindstillinger', 'Allmänna programinställningar', 'Definições gerais da aplicação', '常规应用设置', '一般的なアプリケーション設定'],
  ['Wiedergabe', 'Playback', 'Reproducción', 'Воспроизведение', 'Afspilning', 'Uppspelning', 'Reprodução', '播放', '再生'],
  ['Ändern der Wiedergabeeinstellungen', 'Change playback settings', 'Cambiar ajustes de reproducción', 'Изменение настроек воспроизведения', 'Skift afspilningsindstillinger', 'Ändra uppspelningsinställningar', 'Alterar definições de reprodução', '更改播放设置', '再生設定の変更'],
  ['Aufnahme', 'Capture', 'Captura', 'Запись', 'Optagelse', 'Inspelning', 'Captura', '录音', '録音'],
  ['Mikrofon und Sprachübertragung', 'Microphone and voice transmission', 'Micrófono y transmisión de voz', 'Микрофон и передача голоса', 'Mikrofon og stemmeoverførsel', 'Mikrofon och röstöverföring', 'Microfone e transmissão de voz', '麦克风与语音传输', 'マイクと音声送信'],
  ['Design', 'Design', 'Diseño', 'Оформление', 'Design', 'Design', 'Design', '外观', 'デザイン'],
  ['Farben, Schrift und Darstellung', 'Colours, font and display', 'Colores, fuente y visualización', 'Цвета, шрифт и отображение', 'Farver, skrift og visning', 'Färger, typsnitt och visning', 'Cores, letra e apresentação', '颜色、字体和显示', '色・フォント・表示'],
  ['Hotkeys', 'Hotkeys', 'Teclas rápidas', 'Горячие клавиши', 'Genvejstaster', 'Snabbtangenter', 'Teclas de atalho', '热键', 'ホットキー'],
  ['Globale Tastenkürzel', 'Global shortcuts', 'Atajos globales', 'Глобальные горячие клавиши', 'Globale genveje', 'Globala kortkommandon', 'Atalhos globais', '全局快捷键', 'グローバルショートカット'],
  ['Chat', 'Chat', 'Chat', 'Чат', 'Chat', 'Chatt', 'Chat', '聊天', 'チャット'],
  ['Darstellung des Chats', 'Chat display', 'Visualización del chat', 'Отображение чата', 'Chatvisning', 'Chattvisning', 'Apresentação do chat', '聊天显示', 'チャットの表示'],
  ['Meldungen', 'Notifications', 'Notificaciones', 'Уведомления', 'Meddelelser', 'Aviseringar', 'Notificações', '通知', '通知'],
  ['Sprachansagen und Töne', 'Voice announcements and tones', 'Anuncios de voz y tonos', 'Голосовые оповещения и сигналы', 'Stemmemeddelelser og toner', 'Röstmeddelanden och toner', 'Anúncios de voz e tons', '语音提示和提示音', '音声アナウンスと効果音'],
  ['Sicherheit', 'Security', 'Seguridad', 'Безопасность', 'Sikkerhed', 'Säkerhet', 'Segurança', '安全', 'セキュリティ'],
  ['Identität und Sicherheitslevel', 'Identity and security level', 'Identidad y nivel de seguridad', 'Личность и уровень безопасности', 'Identitet og sikkerhedsniveau', 'Identitet och säkerhetsnivå', 'Identidade e nível de segurança', '身份与安全等级', 'ID とセキュリティレベル'],
  ['Mikrofon beim Wechseln des Servers automatisch aktivieren', 'Automatically enable microphone when switching servers', 'Activar el micrófono al cambiar de servidor', 'Включать микрофон при смене сервера', 'Aktivér mikrofon automatisk ved serverskift', 'Aktivera mikrofonen automatiskt vid serverbyte', 'Ativar o microfone ao mudar de servidor', '切换服务器时自动开启麦克风', 'サーバー切替時にマイクを自動で有効化'],
  ['Nach Verbindungsverlust automatisch neu verbinden', 'Reconnect automatically after connection loss', 'Reconectar automáticamente tras perder la conexión', 'Переподключаться после потери соединения', 'Genforbind automatisk efter forbindelsestab', 'Återanslut automatiskt efter avbrott', 'Religar automaticamente após perda de ligação', '断线后自动重连', '切断後に自動で再接続'],
  ['Mittlere Maustaste als Schnellzugriff im Baum benutzen', 'Use middle mouse button as quick access in the tree', 'Usar el botón central como acceso rápido en el árbol', 'Средняя кнопка мыши — быстрый доступ в дереве', 'Brug midterste museknap som genvej i træet', 'Använd mittenknappen som snabbåtkomst i trädet', 'Usar o botão do meio como acesso rápido na árvore', '在树中使用鼠标中键快速访问', 'ツリーで中ボタンをクイックアクセスに使用'],
  ['Channel betreten / Nachricht', 'join channel / message', 'entrar al canal / mensaje', 'войти в канал / сообщение', 'gå ind i kanal / besked', 'gå med i kanal / meddelande', 'entrar no canal / mensagem', '进入频道 / 消息', 'チャンネル参加 / メッセージ'],
  ['Spitznamen in Favoriten automatisch aktualisieren', 'Update nicknames in bookmarks automatically', 'Actualizar apodos en favoritos automáticamente', 'Автоматически обновлять никнеймы в избранном', 'Opdater kaldenavne i favoritter automatisk', 'Uppdatera smeknamn i favoriter automatiskt', 'Atualizar alcunhas nos favoritos automaticamente', '自动更新收藏中的昵称', 'ブックマークのニックネームを自動更新'],
  ['Verschiedenes', 'Miscellaneous', 'Varios', 'Разное', 'Diverse', 'Övrigt', 'Diversos', '其他', 'その他'],
  ['Immer im Vordergrund', 'Always on top', 'Siempre visible', 'Поверх всех окон', 'Altid øverst', 'Alltid överst', 'Sempre visível', '始终置顶', '常に最前面'],
  ['Channel-Chat bei neuen Nachrichten automatisch öffnen', 'Open channel chat automatically on new messages', 'Abrir el chat del canal al recibir mensajes', 'Открывать чат канала при новых сообщениях', 'Åbn kanalchat automatisk ved nye beskeder', 'Öppna kanalchatt automatiskt vid nya meddelanden', 'Abrir o chat do canal ao receber mensagens', '有新消息时自动打开频道聊天', '新着メッセージでチャンネルチャットを自動で開く'],
  ['Fortgeschrittenes Rechtesystem (Expertenansicht mit einzelnen Rechten)', 'Advanced permission system (expert view with single permissions)', 'Sistema de permisos avanzado (vista experta)', 'Расширенная система прав (экспертный вид)', 'Avanceret rettighedssystem (ekspertvisning)', 'Avancerat behörighetssystem (expertvy)', 'Sistema de permissões avançado (vista de especialista)', '高级权限系统（专家视图）', '高度な権限システム（エキスパート表示）'],
  ['Akustischen Hinweis abspielen, wenn das Mikrofon gemutet ist', 'Play an acoustic hint when the microphone is muted', 'Reproducir un aviso si el micrófono está silenciado', 'Звуковое напоминание, если микрофон выключен', 'Afspil lydhint når mikrofonen er slået fra', 'Spela upp en ljudsignal när mikrofonen är avstängd', 'Tocar aviso sonoro se o microfone estiver silenciado', '麦克风静音时播放提示音', 'マイクがミュートのとき音で知らせる'],
  ['RustSpeak automatisch mit Windows starten', 'Start RustSpeak automatically with Windows', 'Iniciar RustSpeak con Windows', 'Запускать RustSpeak вместе с Windows', 'Start RustSpeak automatisk med Windows', 'Starta RustSpeak automatiskt med Windows', 'Iniciar o RustSpeak com o Windows', '开机时自动启动 RustSpeak', 'Windows 起動時に RustSpeak を開始'],
  ['Anstupsen-Dialog nie zeigen (nur Hinweis unten rechts)', 'Never show poke dialog (only a hint at the bottom right)', 'No mostrar nunca el diálogo de toque (solo aviso)', 'Не показывать окно тычка (только уведомление)', 'Vis aldrig prik-dialog (kun hint nederst til højre)', 'Visa aldrig petdialog (bara en notis nere till höger)', 'Nunca mostrar diálogo de cutucada (só aviso)', '从不显示戳一下对话框（仅右下角提示）', 'つつきダイアログを表示しない（右下に通知のみ）'],
  ['Anzeigesprache', 'Display language', 'Idioma de la interfaz', 'Язык интерфейса', 'Visningssprog', 'Visningsspråk', 'Idioma da interface', '界面语言', '表示言語'],
  ['Daten', 'Data', 'Datos', 'Данные', 'Data', 'Data', 'Dados', '数据', 'データ'],
  ['Identität, Audio-Einstellungen und Favoriten werden lokal gespeichert.', 'Identity, audio settings and bookmarks are stored locally.', 'La identidad, el audio y los favoritos se guardan localmente.', 'Личность, настройки звука и избранное хранятся локально.', 'Identitet, lydindstillinger og favoritter gemmes lokalt.', 'Identitet, ljudinställningar och favoriter sparas lokalt.', 'Identidade, áudio e favoritos são guardados localmente.', '身份、音频设置和收藏保存在本地。', 'ID・音声設定・ブックマークはローカルに保存されます。'],
  ['Darstellung und Optionen zurücksetzen', 'Reset appearance and options', 'Restablecer apariencia y opciones', 'Сбросить вид и параметры', 'Nulstil udseende og indstillinger', 'Återställ utseende och alternativ', 'Repor aparência e opções', '重置外观和选项', '表示とオプションをリセット'],
  ['Wiedergabegerät', 'Playback device', 'Dispositivo de reproducción', 'Устройство воспроизведения', 'Afspilningsenhed', 'Uppspelningsenhet', 'Dispositivo de reprodução', '播放设备', '再生デバイス'],
  ['Standardgerät', 'Default device', 'Dispositivo predeterminado', 'Устройство по умолчанию', 'Standardenhed', 'Standardenhet', 'Dispositivo predefinido', '默认设备', '既定のデバイス'],
  ['Leise', 'Quiet', 'Bajo', 'Тихо', 'Lavt', 'Tyst', 'Baixo', '小声', '小'],
  ['Laut', 'Loud', 'Alto', 'Громко', 'Højt', 'Högt', 'Alto', '大声', '大'],
  ['Sprachlautstärke', 'Voice volume', 'Volumen de voz', 'Громкость голоса', 'Stemmelydstyrke', 'Röstvolym', 'Volume da voz', '语音音量', '音声の音量'],
  ['Lautstärke des Sound Packs', 'Sound pack volume', 'Volumen del paquete de sonidos', 'Громкость звукового пакета', 'Lydpakkens lydstyrke', 'Ljudpaketets volym', 'Volume do pacote de sons', '音效包音量', 'サウンドパックの音量'],
  ['Test Ton abspielen', 'Play test sound', 'Reproducir sonido de prueba', 'Воспроизвести тестовый звук', 'Afspil testlyd', 'Spela testljud', 'Tocar som de teste', '播放测试音', 'テスト音を再生'],
  ['Automatische Lautstärkeanpassung (andere Sprecher angleichen)', 'Automatic volume adjustment (level other speakers)', 'Ajuste automático de volumen (igualar a otros)', 'Автоматическая громкость (выравнивать говорящих)', 'Automatisk lydstyrke (udlign andre talere)', 'Automatisk volym (jämna ut andra talare)', 'Ajuste automático de volume (igualar oradores)', '自动音量调节（平衡其他发言者）', '自動音量調整（他の話者をそろえる）'],
  ['Eigener Client spielt Mikro-Klicks', 'Own client plays mic clicks', 'El cliente propio reproduce clics de micro', 'Свой клиент воспроизводит щелчки микрофона', 'Egen klient afspiller mik-klik', 'Egen klient spelar mikrofonklick', 'O próprio cliente toca cliques do micro', '自己客户端播放麦克风咔嗒声', '自分のクライアントでマイククリック音'],
  ['Andere Clients spielen Mikro-Klicks', 'Other clients play mic clicks', 'Otros clientes reproducen clics de micro', 'Другие клиенты воспроизводят щелчки', 'Andre klienter afspiller mik-klik', 'Andra klienter spelar mikrofonklick', 'Outros clientes tocam cliques do micro', '其他客户端播放麦克风咔嗒声', '他のクライアントでマイククリック音'],
  ['Comfort Noise (leises Grundrauschen in Sprechpausen)', 'Comfort noise (soft background noise in pauses)', 'Ruido de confort (ruido suave en las pausas)', 'Комфортный шум (тихий фон в паузах)', 'Comfort noise (svag baggrundsstøj i pauser)', 'Komfortbrus (svagt brus i pauser)', 'Ruído de conforto (ruído suave nas pausas)', '舒适噪声（停顿时的轻微底噪）', 'コンフォートノイズ（無音時の小さなノイズ）'],
  ['Mikrofon testen', 'Test microphone', 'Probar micrófono', 'Проверить микрофон', 'Test mikrofon', 'Testa mikrofon', 'Testar microfone', '测试麦克风', 'マイクをテスト'],
  ['Test beenden', 'Stop test', 'Detener prueba', 'Остановить проверку', 'Stop test', 'Avsluta test', 'Parar teste', '停止测试', 'テスト終了'],
  ['Sprachübertragung', 'Voice transmission', 'Transmisión de voz', 'Передача голоса', 'Stemmeoverførsel', 'Röstöverföring', 'Transmissão de voz', '语音传输', '音声送信'],
  ['Dauerhaft', 'Continuous', 'Continuo', 'Постоянно', 'Altid', 'Alltid', 'Contínuo', '持续', '常時'],
  ['KI-Spracherkennung statt Pegelschwelle (RNNoise-VAD)', 'AI speech detection instead of level threshold (RNNoise VAD)', 'Detección de voz por IA en vez de umbral (RNNoise VAD)', 'ИИ-распознавание речи вместо порога (RNNoise VAD)', 'AI-taledetektion i stedet for niveaugrænse (RNNoise VAD)', 'AI-taldetektering i stället för nivågräns (RNNoise VAD)', 'Deteção de voz por IA em vez de limiar (RNNoise VAD)', 'AI 语音检测代替电平阈值（RNNoise VAD）', 'レベルしきい値の代わりに AI 音声検出（RNNoise VAD）'],
  ['Empfindlich', 'Sensitive', 'Sensible', 'Чувствительно', 'Følsom', 'Känslig', 'Sensível', '灵敏', '高感度'],
  ['Unempfindlich', 'Insensitive', 'Poco sensible', 'Нечувствительно', 'Ufølsom', 'Okänslig', 'Pouco sensível', '不灵敏', '低感度'],
  ['Aktivierungsschwelle', 'Activation threshold', 'Umbral de activación', 'Порог активации', 'Aktiveringsgrænse', 'Aktiveringsgräns', 'Limiar de ativação', '激活阈值', '起動しきい値'],
  ['Spracherkennung', 'Speech detection', 'Detección de voz', 'Распознавание речи', 'Taledetektion', 'Taldetektering', 'Deteção de voz', '语音检测', '音声検出'],
  ['Push-to-Talk-Taste', 'Push-to-talk key', 'Tecla para hablar', 'Клавиша рации', 'Tryk-for-at-tale-tast', 'Tryck-för-att-tala-tangent', 'Tecla para falar', '按键说话按键', 'プッシュトゥトークキー'],
  ['Die Taste wirkt global, auch wenn RustSpeak im Hintergrund ist.', 'The key works globally, even when RustSpeak is in the background.', 'La tecla funciona de forma global, incluso en segundo plano.', 'Клавиша работает глобально, даже если RustSpeak в фоне.', 'Tasten virker globalt, også når RustSpeak er i baggrunden.', 'Tangenten fungerar globalt, även när RustSpeak är i bakgrunden.', 'A tecla funciona globalmente, mesmo com o RustSpeak em segundo plano.', '该按键全局有效，即使 RustSpeak 在后台。', 'RustSpeak がバックグラウンドでもキーはグローバルに動作します。'],
  ['Verarbeitung', 'Processing', 'Procesamiento', 'Обработка', 'Behandling', 'Bearbetning', 'Processamento', '处理', '処理'],
  ['Rauschunterdrückung (RNNoise)', 'Noise suppression (RNNoise)', 'Supresión de ruido (RNNoise)', 'Шумоподавление (RNNoise)', 'Støjreduktion (RNNoise)', 'Brusreducering (RNNoise)', 'Supressão de ruído (RNNoise)', '降噪（RNNoise）', 'ノイズ抑制（RNNoise）'],
  ['Automatische Lautstärkeanpassung des Mikrofons (AGC)', 'Automatic microphone gain control (AGC)', 'Control automático de ganancia (AGC)', 'Автоматическая регулировка усиления (AGC)', 'Automatisk mikrofonforstærkning (AGC)', 'Automatisk mikrofonförstärkning (AGC)', 'Controlo automático de ganho (AGC)', '麦克风自动增益（AGC）', 'マイク自動ゲイン（AGC）'],
  ['Mikrofonverstärkung', 'Microphone gain', 'Ganancia del micrófono', 'Усиление микрофона', 'Mikrofonforstærkning', 'Mikrofonförstärkning', 'Ganho do microfone', '麦克风增益', 'マイクゲイン'],
  ['Akzentfarbe', 'Accent colour', 'Color de acento', 'Цвет акцента', 'Accentfarve', 'Accentfärg', 'Cor de destaque', '强调色', 'アクセントカラー'],
  ['Blau / Lila', 'Blue / purple', 'Azul / morado', 'Синий / фиолетовый', 'Blå / lilla', 'Blå / lila', 'Azul / roxo', '蓝 / 紫', '青 / 紫'],
  ['Türkis', 'Turquoise', 'Turquesa', 'Бирюзовый', 'Turkis', 'Turkos', 'Turquesa', '青绿', 'ターコイズ'],
  ['Grün', 'Green', 'Verde', 'Зелёный', 'Grøn', 'Grön', 'Verde', '绿', '緑'],
  ['Orange', 'Orange', 'Naranja', 'Оранжевый', 'Orange', 'Orange', 'Laranja', '橙', 'オレンジ'],
  ['Rot / Pink', 'Red / pink', 'Rojo / rosa', 'Красный / розовый', 'Rød / pink', 'Röd / rosa', 'Vermelho / rosa', '红 / 粉', '赤 / ピンク'],
  ['Grau', 'Grey', 'Gris', 'Серый', 'Grå', 'Grå', 'Cinzento', '灰', 'グレー'],
  ['Darstellung', 'Appearance', 'Apariencia', 'Внешний вид', 'Udseende', 'Utseende', 'Aparência', '外观', '表示'],
  ['Schriftgröße', 'Font size', 'Tamaño de fuente', 'Размер шрифта', 'Skriftstørrelse', 'Teckenstorlek', 'Tamanho da letra', '字体大小', '文字サイズ'],
  ['Kompakter Channelbaum', 'Compact channel tree', 'Árbol de canales compacto', 'Компактное дерево каналов', 'Kompakt kanaltræ', 'Kompakt kanalträd', 'Árvore de canais compacta', '紧凑频道树', 'コンパクトなチャンネルツリー'],
  ['Gruppen ohne Icon als Kürzel anzeigen (SA, CA, OP …)', 'Show groups without icon as abbreviation (SA, CA, OP …)', 'Mostrar grupos sin icono como abreviatura (SA, CA, OP …)', 'Показывать группы без значка сокращением (SA, CA, OP …)', 'Vis grupper uden ikon som forkortelse (SA, CA, OP …)', 'Visa grupper utan ikon som förkortning (SA, CA, OP …)', 'Mostrar grupos sem ícone como abreviatura (SA, CA, OP …)', '无图标的群组显示为缩写（SA、CA、OP …）', 'アイコンのないグループを略称で表示（SA, CA, OP …）'],
  ['Globale Hotkeys', 'Global hotkeys', 'Teclas rápidas globales', 'Глобальные горячие клавиши', 'Globale genvejstaster', 'Globala snabbtangenter', 'Teclas de atalho globais', '全局热键', 'グローバルホットキー'],
  ['Push-to-Talk (nur im Modus Push-to-Talk)', 'Push-to-talk (only in push-to-talk mode)', 'Pulsar para hablar (solo en ese modo)', 'Рация (только в режиме рации)', 'Tryk-for-at-tale (kun i den tilstand)', 'Tryck-för-att-tala (bara i det läget)', 'Premir para falar (só nesse modo)', '按键说话（仅限按键说话模式）', 'プッシュトゥトーク（PTT モードのみ）'],
  ['Mikrofon an/aus', 'Microphone on/off', 'Micrófono sí/no', 'Микрофон вкл/выкл', 'Mikrofon til/fra', 'Mikrofon på/av', 'Microfone lig./desl.', '麦克风 开/关', 'マイク ON/OFF'],
  ['Lautsprecher an/aus', 'Speakers on/off', 'Altavoces sí/no', 'Динамики вкл/выкл', 'Højttalere til/fra', 'Högtalare på/av', 'Altifalantes lig./desl.', '扬声器 开/关', 'スピーカー ON/OFF'],
  ['Abwesend an/aus', 'Away on/off', 'Ausente sí/no', 'Отошёл вкл/выкл', 'Væk til/fra', 'Borta på/av', 'Ausente lig./desl.', '离开 开/关', '離席 ON/OFF'],
  ['Keine', 'None', 'Ninguna', 'Нет', 'Ingen', 'Ingen', 'Nenhuma', '无', 'なし'],
  ['Taste drücken …', 'Press a key …', 'Pulsa una tecla …', 'Нажмите клавишу …', 'Tryk på en tast …', 'Tryck på en tangent …', 'Prima uma tecla …', '请按键 …', 'キーを押してください …'],
  ['Zeitstempel anzeigen', 'Show timestamps', 'Mostrar marcas de tiempo', 'Показывать время', 'Vis tidsstempler', 'Visa tidsstämplar', 'Mostrar horas', '显示时间戳', 'タイムスタンプを表示'],
  ['Channel-Ereignisse (Betreten, Verlassen, Verschieben) im Channel-Chat anzeigen', 'Show channel events (join, leave, move) in channel chat', 'Mostrar eventos del canal en el chat del canal', 'Показывать события канала в чате канала', 'Vis kanalhændelser i kanalchatten', 'Visa kanalhändelser i kanalchatten', 'Mostrar eventos do canal no chat do canal', '在频道聊天中显示频道事件（进入、离开、移动）', 'チャンネルチャットにイベント（参加・退出・移動）を表示'],
  ['Klänge', 'Sounds', 'Sonidos', 'Звуки', 'Lyde', 'Ljud', 'Sons', '声音', 'サウンド'],
  ['Sprachansagen', 'Voice announcements', 'Anuncios de voz', 'Голосовые оповещения', 'Stemmemeddelelser', 'Röstmeddelanden', 'Anúncios de voz', '语音提示', '音声アナウンス'],
  ['Töne', 'Tones', 'Tonos', 'Сигналы', 'Toner', 'Toner', 'Tons', '提示音', '効果音'],
  ['Aus', 'Off', 'Apagado', 'Выкл', 'Fra', 'Av', 'Desligado', '关闭', 'オフ'],
  ['Stimme', 'Voice', 'Voz', 'Голос', 'Stemme', 'Röst', 'Voz', '嗓音', '音声'],
  ['Automatisch (Deutsch)', 'Automatic', 'Automática', 'Автоматически', 'Automatisk', 'Automatisk', 'Automática', '自动', '自動'],
  ['Probe anhören', 'Listen to sample', 'Escuchar muestra', 'Прослушать пример', 'Lyt til prøve', 'Lyssna på prov', 'Ouvir amostra', '试听', 'サンプルを聞く'],
  ['Ereignisse', 'Events', 'Eventos', 'События', 'Hændelser', 'Händelser', 'Eventos', '事件', 'イベント'],
  ['Ton bei Channel- und Servernachrichten', 'Sound on channel and server messages', 'Sonido en mensajes del canal y del servidor', 'Звук при сообщениях канала и сервера', 'Lyd ved kanal- og serverbeskeder', 'Ljud vid kanal- och servermeddelanden', 'Som nas mensagens do canal e do servidor', '频道和服务器消息时播放声音', 'チャンネル・サーバーメッセージで音を鳴らす'],
  ['Ansage, wenn Benutzer den Server betreten/verlassen', 'Announce when users join/leave the server', 'Anunciar cuando usuarios entran/salen del servidor', 'Оповещать о входе/выходе пользователей', 'Meddel når brugere går ind/ud af serveren', 'Meddela när användare ansluter/lämnar servern', 'Anunciar quando utilizadores entram/saem', '用户进出服务器时提示', 'ユーザーのサーバー参加/退出を通知'],
  ['Identität', 'Identity', 'Identidad', 'Личность', 'Identitet', 'Identitet', 'Identidade', '身份', 'ID'],
  ['Ziel-Level', 'Target level', 'Nivel objetivo', 'Целевой уровень', 'Mål-niveau', 'Målnivå', 'Nível alvo', '目标等级', '目標レベル'],
  ['Sicherheitslevel erhöhen', 'Increase security level', 'Aumentar nivel de seguridad', 'Повысить уровень безопасности', 'Øg sikkerhedsniveau', 'Höj säkerhetsnivå', 'Aumentar nível de segurança', '提升安全等级', 'セキュリティレベルを上げる'],
  ['Eindeutige ID', 'Unique ID', 'ID única', 'Уникальный ID', 'Unikt ID', 'Unikt ID', 'ID único', '唯一 ID', '固有 ID'],
  ['Sicherheitslevel', 'Security level', 'Nivel de seguridad', 'Уровень безопасности', 'Sikkerhedsniveau', 'Säkerhetsnivå', 'Nível de segurança', '安全等级', 'セキュリティレベル'],
  ['Offset', 'Offset', 'Desplazamiento', 'Смещение', 'Offset', 'Offset', 'Deslocamento', '偏移量', 'オフセット'],
  ['Ein höheres Level wird von manchen Servern verlangt. Die Berechnung kann bei Level 25+ mehrere Minuten dauern.', 'Some servers require a higher level. Computing level 25+ can take several minutes.', 'Algunos servidores exigen un nivel mayor. El nivel 25+ puede tardar varios minutos.', 'Некоторые серверы требуют более высокий уровень. Расчёт уровня 25+ может занять минуты.', 'Nogle servere kræver et højere niveau. Niveau 25+ kan tage flere minutter.', 'Vissa servrar kräver en högre nivå. Nivå 25+ kan ta flera minuter.', 'Alguns servidores exigem um nível maior. O nível 25+ pode demorar vários minutos.', '部分服务器要求更高等级。计算 25 级以上可能需要几分钟。', '一部のサーバーは高いレベルを要求します。25 以上の計算には数分かかることがあります。'],
  ['Audiogeräte gewechselt', 'Audio devices changed', 'Dispositivos de audio cambiados', 'Аудиоустройства изменены', 'Lydenheder skiftet', 'Ljudenheter bytta', 'Dispositivos de áudio alterados', '音频设备已更改', 'オーディオデバイスを変更しました'],
  // ---------------------------------------------------------------- rights window
  ['Expertenansicht', 'Expert view', 'Vista experta', 'Экспертный вид', 'Ekspertvisning', 'Expertvy', 'Vista de especialista', '专家视图', 'エキスパート表示'],
  ['Server Gruppen', 'Server groups', 'Grupos del servidor', 'Группы сервера', 'Servergrupper', 'Servergrupper', 'Grupos do servidor', '服务器群组', 'サーバーグループ'],
  ['Channel Gruppen', 'Channel groups', 'Grupos del canal', 'Группы канала', 'Kanalgrupper', 'Kanalgrupper', 'Grupos do canal', '频道群组', 'チャンネルグループ'],
  ['Servergruppe', 'Server group', 'Grupo del servidor', 'Группа сервера', 'Servergruppe', 'Servergrupp', 'Grupo do servidor', '服务器群组', 'サーバーグループ'],
  ['Icon', 'Icon', 'Icono', 'Значок', 'Ikon', 'Ikon', 'Ícone', '图标', 'アイコン'],
  ['Name im Baum anzeigen', 'Show name in tree', 'Mostrar nombre en el árbol', 'Показывать имя в дереве', 'Vis navn i træet', 'Visa namn i trädet', 'Mostrar nome na árvore', '在树中显示名称', 'ツリーに名前を表示'],
  ['Nicht anzeigen', 'Do not show', 'No mostrar', 'Не показывать', 'Vis ikke', 'Visa inte', 'Não mostrar', '不显示', '表示しない'],
  ['Vor dem Namen', 'Before the name', 'Antes del nombre', 'Перед именем', 'Før navnet', 'Före namnet', 'Antes do nome', '名称之前', '名前の前'],
  ['Nach dem Namen', 'After the name', 'Después del nombre', 'После имени', 'Efter navnet', 'Efter namnet', 'Depois do nome', '名称之后', '名前の後'],
  ['Gruppen-Optionen', 'Group options', 'Opciones del grupo', 'Параметры группы', 'Gruppeindstillinger', 'Gruppalternativ', 'Opções do grupo', '群组选项', 'グループオプション'],
  ['Den Server administrieren', 'Administer the server', 'Administrar el servidor', 'Администрировать сервер', 'Administrer serveren', 'Administrera servern', 'Administrar o servidor', '管理服务器', 'サーバーを管理'],
  ['Einstellungen editieren, Banner setzen, Icons verwalten', 'edit settings, set banner, manage icons', 'editar ajustes, banner, iconos', 'настройки, баннер, значки', 'rediger indstillinger, banner, ikoner', 'redigera inställningar, banner, ikoner', 'editar definições, banner, ícones', '编辑设置、设置横幅、管理图标', '設定編集・バナー設定・アイコン管理'],
  ['Gruppen verwalten', 'Manage groups', 'Gestionar grupos', 'Управлять группами', 'Administrer grupper', 'Hantera grupper', 'Gerir grupos', '管理群组', 'グループを管理'],
  ['erstellen, löschen, editieren', 'create, delete, edit', 'crear, eliminar, editar', 'создавать, удалять, изменять', 'opret, slet, rediger', 'skapa, ta bort, redigera', 'criar, eliminar, editar', '创建、删除、编辑', '作成・削除・編集'],
  ['Mitglieder hinzufügen und entfernen', 'Add and remove members', 'Añadir y quitar miembros', 'Добавлять и удалять участников', 'Tilføj og fjern medlemmer', 'Lägg till och ta bort medlemmar', 'Adicionar e remover membros', '添加和移除成员', 'メンバーの追加と削除'],
  ['Benutzer hinzufügen, Berechtigungsschlüssel verwalten', 'add users, manage privilege keys', 'añadir usuarios, gestionar claves', 'добавлять пользователей, управлять ключами', 'tilføj brugere, administrer nøgler', 'lägg till användare, hantera nycklar', 'adicionar utilizadores, gerir chaves', '添加用户、管理权限密钥', 'ユーザー追加・権限キー管理'],
  ['Clients administrieren', 'Administer clients', 'Administrar clientes', 'Управлять клиентами', 'Administrer klienter', 'Administrera klienter', 'Administrar clientes', '管理客户端', 'クライアントを管理'],
  ['verschieben, kicken, bannen, IP-Adressen sehen', 'move, kick, ban, see IP addresses', 'mover, expulsar, banear, ver IPs', 'перемещать, кикать, банить, видеть IP', 'flyt, smid ud, ban, se IP-adresser', 'flytta, sparka, bannlys, se IP-adresser', 'mover, expulsar, banir, ver IPs', '移动、踢出、封禁、查看 IP', '移動・キック・BAN・IP 表示'],
  ['Channel verwalten', 'Manage channels', 'Gestionar canales', 'Управлять каналами', 'Administrer kanaler', 'Hantera kanaler', 'Gerir canais', '管理频道', 'チャンネルを管理'],
  ['erstellen, bearbeiten, löschen', 'create, edit, delete', 'crear, editar, eliminar', 'создавать, изменять, удалять', 'opret, rediger, slet', 'skapa, redigera, ta bort', 'criar, editar, eliminar', '创建、编辑、删除', '作成・編集・削除'],
  ['Grundlagen', 'Basics', 'Básicos', 'Основы', 'Grundlæggende', 'Grunder', 'Básicos', '基础', '基本'],
  ['Nachrichten senden, anstupsen, Channel betreten, sprechen, temporäre Channel erstellen', 'send messages, poke, join channels, talk, create temporary channels', 'enviar mensajes, dar toques, entrar a canales, hablar, crear canales temporales', 'писать сообщения, тыкать, входить в каналы, говорить, создавать временные каналы', 'send beskeder, prik, gå ind i kanaler, tal, opret midlertidige kanaler', 'skicka meddelanden, peta, gå med i kanaler, prata, skapa tillfälliga kanaler', 'enviar mensagens, cutucar, entrar em canais, falar, criar canais temporários', '发送消息、戳一下、进入频道、发言、创建临时频道', 'メッセージ送信・つつく・チャンネル参加・発言・一時チャンネル作成'],
  ['Vor anderen geschützt', 'Protected from others', 'Protegido de otros', 'Защищён от других', 'Beskyttet mod andre', 'Skyddad från andra', 'Protegido dos outros', '受保护', '他者から保護'],
  ['kann von Gästen nicht verschoben, gekickt, gebannt oder angestupst werden', 'cannot be moved, kicked, banned or poked by guests', 'los invitados no pueden moverlo, expulsarlo, banearlo ni darle toques', 'гости не могут перемещать, кикать, банить или тыкать', 'kan ikke flyttes, smides ud, bannes eller prikkes af gæster', 'kan inte flyttas, sparkas, bannlysas eller petas av gäster', 'convidados não podem mover, expulsar, banir ou cutucar', '访客无法移动、踢出、封禁或戳', 'ゲストから移動・キック・BAN・つつきされない'],
  ['Channel administrieren', 'Administer channel', 'Administrar canal', 'Администрировать канал', 'Administrer kanal', 'Administrera kanal', 'Administrar canal', '管理频道', 'チャンネルを管理'],
  ['Channel bearbeiten und löschen, Unterchannel erstellen, Channel-Icon setzen', 'edit and delete channel, create sub-channels, set channel icon', 'editar y eliminar canal, crear subcanales, icono', 'изменять и удалять канал, подканалы, значок', 'rediger og slet kanal, underkanaler, kanalikon', 'redigera och ta bort kanal, underkanaler, kanalikon', 'editar e eliminar canal, subcanais, ícone', '编辑和删除频道、创建子频道、设置频道图标', 'チャンネル編集・削除・サブチャンネル作成・アイコン設定'],
  ['Channel moderieren', 'Moderate channel', 'Moderar canal', 'Модерировать канал', 'Moderér kanal', 'Moderera kanal', 'Moderar canal', '管理频道秩序', 'チャンネルをモデレート'],
  ['Clients im Channel verschieben und aus dem Channel werfen', 'move clients in the channel and kick them from it', 'mover clientes del canal y expulsarlos', 'перемещать клиентов и выгонять из канала', 'flyt klienter og smid dem ud af kanalen', 'flytta klienter och sparka dem från kanalen', 'mover clientes e expulsá-los do canal', '移动频道内客户端并将其踢出', 'チャンネル内のクライアントを移動・キック'],
  ['Channelgruppen vergeben', 'Assign channel groups', 'Asignar grupos de canal', 'Назначать группы канала', 'Tildel kanalgrupper', 'Tilldela kanalgrupper', 'Atribuir grupos de canal', '分配频道群组', 'チャンネルグループを付与'],
  ['anderen im Channel eine Channelgruppe geben', 'give others in the channel a channel group', 'dar a otros un grupo de canal', 'выдавать другим группу канала', 'giv andre i kanalen en kanalgruppe', 'ge andra i kanalen en kanalgrupp', 'dar a outros um grupo de canal', '给频道中的其他人分配频道群组', 'チャンネル内の他者にグループを付与'],
  ['Sprechen in moderierten Channels', 'Talk in moderated channels', 'Hablar en canales moderados', 'Говорить в модерируемых каналах', 'Tal i modererede kanaler', 'Prata i modererade kanaler', 'Falar em canais moderados', '在受管频道中发言', 'モデレートチャンネルで発言'],
  ['erhöhte Sprechkraft (50)', 'increased talk power (50)', 'poder de habla aumentado (50)', 'повышенная сила голоса (50)', 'øget taleret (50)', 'ökad talkraft (50)', 'poder de fala aumentado (50)', '提高发言权（50）', '発言力アップ（50）'],
  ['Thema bearbeiten', 'Edit topic', 'Editar tema', 'Изменять тему', 'Rediger emne', 'Redigera ämne', 'Editar tema', '编辑主题', 'トピックを編集'],
  ['Thema und Beschreibung des Channels ändern', 'change the channel topic and description', 'cambiar tema y descripción del canal', 'менять тему и описание канала', 'skift kanalens emne og beskrivelse', 'ändra kanalens ämne och beskrivning', 'alterar tema e descrição do canal', '修改频道主题和描述', 'チャンネルのトピックと説明を変更'],
  ['Einzelne Rechte und genaue Werte findest du in der Expertenansicht (Schalter oben rechts oder Einstellungen → Anwendung → „Fortgeschrittenes Rechtesystem“).', 'Single permissions and exact values are in the expert view (switch at the top right or Settings → Application → “Advanced permission system”).', 'Los permisos individuales están en la vista experta (interruptor arriba a la derecha o Ajustes → Aplicación).', 'Отдельные права и точные значения — в экспертном виде (переключатель справа вверху или Настройки → Приложение).', 'Enkelte rettigheder findes i ekspertvisningen (kontakt øverst til højre eller Indstillinger → Program).', 'Enskilda behörigheter finns i expertvyn (reglaget uppe till höger eller Inställningar → Program).', 'As permissões individuais estão na vista de especialista (interruptor no canto superior direito ou Definições → Aplicação).', '单项权限和精确值在专家视图中（右上角开关或 设置 → 应用程序）。', '個別の権限と値はエキスパート表示にあります（右上のスイッチまたは 設定 → アプリケーション）。'],
  ['Rechte durchsuchen …', 'Search permissions …', 'Buscar permisos …', 'Поиск прав …', 'Søg rettigheder …', 'Sök behörigheter …', 'Procurar permissões …', '搜索权限 …', '権限を検索 …'],
  ['Nur gesetzte', 'Only set', 'Solo definidos', 'Только заданные', 'Kun satte', 'Endast satta', 'Só definidas', '仅已设置', '設定済みのみ'],
  ['erlaubt', 'allowed', 'permitido', 'разрешено', 'tilladt', 'tillåtet', 'permitido', '允许', '許可'],
  ['verboten', 'denied', 'denegado', 'запрещено', 'nægtet', 'nekat', 'negado', '禁止', '拒否'],
  ['Suchen', 'Search', 'Buscar', 'Поиск', 'Søg', 'Sök', 'Procurar', '搜索', '検索'],
  ['Rechte gespeichert', 'Permissions saved', 'Permisos guardados', 'Права сохранены', 'Rettigheder gemt', 'Behörigheter sparade', 'Permissões guardadas', '权限已保存', '権限を保存しました'],
  ['Channelgruppen gelten pro Channel. Vergib sie per Rechtsklick auf einen Client → „Channelgruppe“.', 'Channel groups apply per channel. Assign them by right-clicking a client → “Channel group”.', 'Los grupos de canal se aplican por canal. Asígnalos con clic derecho → «Grupo del canal».', 'Группы канала действуют для каждого канала. Назначайте правым щелчком → «Группа канала».', 'Kanalgrupper gælder pr. kanal. Tildel dem via højreklik → „Kanalgruppe“.', 'Kanalgrupper gäller per kanal. Tilldela via högerklick → ”Kanalgrupp”.', 'Os grupos de canal aplicam-se por canal. Atribua com clique direito → «Grupo do canal».', '频道群组按频道生效。右键客户端 → “频道群组” 进行分配。', 'チャンネルグループはチャンネルごとです。クライアントを右クリック → 「チャンネルグループ」で付与。'],
  ['Gruppen-Icon', 'Group icon', 'Icono del grupo', 'Значок группы', 'Gruppeikon', 'Gruppikon', 'Ícone do grupo', '群组图标', 'グループアイコン'],
  ['Neue Gruppe', 'New group', 'Nuevo grupo', 'Новая группа', 'Ny gruppe', 'Ny grupp', 'Novo grupo', '新群组', '新しいグループ'],
  ['Gruppe kopieren', 'Copy group', 'Copiar grupo', 'Копировать группу', 'Kopiér gruppe', 'Kopiera grupp', 'Copiar grupo', '复制群组', 'グループをコピー'],
];

// Dynamic texts: {0}, {1}, … are kept (and translated themselves when they match).
const I18N_PATTERNS = [
  ['{0} (du)', '{0} (you)', '{0} (tú)', '{0} (вы)', '{0} (dig)', '{0} (du)', '{0} (você)', '{0}（你）', '{0}（あなた）'],
  ['Qualität: {0}', 'Quality: {0}', 'Calidad: {0}', 'Качество: {0}', 'Kvalitet: {0}', 'Kvalitet: {0}', 'Qualidade: {0}', '画质：{0}', '画質: {0}'],
  ['Video von {0} kann nicht dekodiert werden ({1}).', 'Video from {0} cannot be decoded ({1}).', 'No se puede decodificar el vídeo de {0} ({1}).', 'Не удаётся декодировать видео от {0} ({1}).', 'Video fra {0} kan ikke afkodes ({1}).', 'Video från {0} kan inte avkodas ({1}).', 'Não é possível descodificar o vídeo de {0} ({1}).', '无法解码来自 {0} 的视频（{1}）。', '{0} のビデオをデコードできません（{1}）。'],
  ['Bot „{0}“ angelegt, Schlüssel kopiert.', 'Bot “{0}” created, key copied.', 'Bot «{0}» creado, clave copiada.', 'Бот «{0}» создан, ключ скопирован.', 'Bot „{0}“ oprettet, nøgle kopieret.', 'Bot ”{0}” skapad, nyckel kopierad.', 'Bot «{0}» criado, chave copiada.', '已创建机器人“{0}”，密钥已复制。', 'ボット「{0}」を作成し、キーをコピーしました。'],
  ['Bots melden sich per TCP auf Port 10013 dieses Servers ({0}) mit einem Bot-Schlüssel an und erscheinen dann wie normale Clients im Channelbaum. Man kann sie anschreiben und anstupsen. Ein Beispiel liegt in {1}.', 'Bots log in over TCP on port 10013 of this server ({0}) with a bot key and then appear as normal clients in the channel tree. You can message and poke them. An example is in {1}.', 'Los bots se conectan por TCP al puerto 10013 de este servidor ({0}) con una clave de bot y aparecen como clientes normales en el árbol de canales. Puedes escribirles y darles un toque. Hay un ejemplo en {1}.', 'Боты подключаются по TCP к порту 10013 этого сервера ({0}) с ключом бота и отображаются как обычные клиенты в дереве каналов. Им можно писать и их можно «тыкать». Пример лежит в {1}.', 'Bots logger ind via TCP på port 10013 på denne server ({0}) med en botnøgle og vises derefter som normale klienter i kanaltræet. Du kan skrive til dem og prikke dem. Et eksempel ligger i {1}.', 'Botar loggar in via TCP på port 10013 på denna server ({0}) med en botnyckel och visas sedan som vanliga klienter i kanalträdet. Du kan skriva till dem och peta på dem. Ett exempel finns i {1}.', 'Os bots ligam-se por TCP à porta 10013 deste servidor ({0}) com uma chave de bot e aparecem como clientes normais na árvore de canais. Pode escrever-lhes e cutucá-los. Há um exemplo em {1}.', '机器人使用机器人密钥通过 TCP 连接本服务器（{0}）的 10013 端口，随后会像普通客户端一样显示在频道树中。你可以给它们发消息或戳它们。示例见 {1}。', 'ボットはボットキーを使ってこのサーバー（{0}）のTCPポート10013にログインし、通常のクライアントとしてチャンネルツリーに表示されます。メッセージを送ったりつついたりできます。例は {1} にあります。'],
  ['Du teilst „{0}“.', 'You are sharing “{0}”.', 'Estás compartiendo «{0}».', 'Вы показываете «{0}».', 'Du deler „{0}“.', 'Du delar ”{0}”.', 'Está a partilhar «{0}».', '你正在共享“{0}”。', '「{0}」を共有しています。'],
  ['Möchtest du die Übertragung von {0} wirklich beenden?', 'Do you really want to stop sharing {0}?', '¿Seguro que quieres dejar de compartir {0}?', 'Вы действительно хотите остановить показ {0}?', 'Vil du virkelig stoppe delingen af {0}?', 'Vill du verkligen sluta dela {0}?', 'Quer mesmo parar a partilha de {0}?', '确定要停止共享 {0} 吗？', '{0} の共有を本当に停止しますか？'],
  ['„{0}“ ist blockiert.', '“{0}” is blocked.', '«{0}» está bloqueado.', '«{0}» заблокирован.', '„{0}“ er blokeret.', '”{0}” är blockerad.', '«{0}» está bloqueado.', '“{0}”已被屏蔽。', '「{0}」をブロックしました。'],
  ['„{0}“ ist nicht mehr blockiert.', '“{0}” is no longer blocked.', '«{0}» ya no está bloqueado.', '«{0}» больше не заблокирован.', '„{0}“ er ikke længere blokeret.', '”{0}” är inte längre blockerad.', '«{0}» já não está bloqueado.', '“{0}”已取消屏蔽。', '「{0}」のブロックを解除しました。'],
  ['Verbunden mit {0}', 'Connected to {0}', 'Conectado a {0}', 'Подключено к {0}', 'Forbundet til {0}', 'Ansluten till {0}', 'Ligado a {0}', '已连接到 {0}', '{0} に接続しました'],
  ['Verbinde mit {0} …', 'Connecting to {0} …', 'Conectando a {0} …', 'Подключение к {0} …', 'Forbinder til {0} …', 'Ansluter till {0} …', 'A ligar a {0} …', '正在连接到 {0} …', '{0} に接続中 …'],
  ['Nicht verbunden – {0}', 'Not connected – {0}', 'No conectado – {0}', 'Не подключено – {0}', 'Ikke forbundet – {0}', 'Inte ansluten – {0}', 'Não ligado – {0}', '未连接 – {0}', '未接続 – {0}'],
  ['RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}', 'RNNoise · {0}'],
  ['Ping {0} ms', 'Ping {0} ms', 'Ping {0} ms', 'Пинг {0} мс', 'Ping {0} ms', 'Ping {0} ms', 'Ping {0} ms', '延迟 {0} ms', 'Ping {0} ms'],
  ['Deine Gruppen: {0}', 'Your groups: {0}', 'Tus grupos: {0}', 'Ваши группы: {0}', 'Dine grupper: {0}', 'Dina grupper: {0}', 'Os seus grupos: {0}', '你的群组：{0}', 'あなたのグループ: {0}'],
  ['{0} Clients ausgewählt', '{0} clients selected', '{0} clientes seleccionados', 'Выбрано клиентов: {0}', '{0} klienter valgt', '{0} klienter valda', '{0} clientes selecionados', '已选择 {0} 个客户端', '{0} 件のクライアントを選択'],
  ['Channelgruppe in „{0}“', 'Channel group in “{0}”', 'Grupo del canal en «{0}»', 'Группа канала в «{0}»', 'Kanalgruppe i „{0}“', 'Kanalgrupp i ”{0}”', 'Grupo do canal em «{0}»', '“{0}” 中的频道群组', '「{0}」のチャンネルグループ'],
  ['Private Nachricht an {0} …', 'Private message to {0} …', 'Mensaje privado a {0} …', 'Личное сообщение для {0} …', 'Privat besked til {0} …', 'Privat meddelande till {0} …', 'Mensagem privada para {0} …', '发给 {0} 的私聊 …', '{0} へのプライベートメッセージ …'],
  ['Verbindungsinfo – {0}', 'Connection info – {0}', 'Información de conexión – {0}', 'Информация о соединении – {0}', 'Forbindelsesinfo – {0}', 'Anslutningsinfo – {0}', 'Informação de ligação – {0}', '连接信息 – {0}', '接続情報 – {0}'],
  ['Rechte – {0}', 'Permissions – {0}', 'Permisos – {0}', 'Права – {0}', 'Rettigheder – {0}', 'Behörigheter – {0}', 'Permissões – {0}', '权限 – {0}', '権限 – {0}'],
  ['{0} ungespeicherte Änderung(en)', '{0} unsaved change(s)', '{0} cambio(s) sin guardar', 'Несохранённых изменений: {0}', '{0} ikke-gemte ændring(er)', '{0} osparad(e) ändring(ar)', '{0} alteração(ões) por guardar', '{0} 项未保存的更改', '未保存の変更 {0} 件'],
  ['in „{0}“', 'in “{0}”', 'en «{0}»', 'в «{0}»', 'i „{0}“', 'i ”{0}”', 'em «{0}»', '在“{0}”中', '「{0}」内'],
  ['Mitglieder ({0})', 'Members ({0})', 'Miembros ({0})', 'Участники ({0})', 'Medlemmer ({0})', 'Medlemmar ({0})', 'Membros ({0})', '成员（{0}）', 'メンバー（{0}）'],
  ['Passwort für „{0}“', 'Password for “{0}”', 'Contraseña de «{0}»', 'Пароль для «{0}»', 'Adgangskode til „{0}“', 'Lösenord för ”{0}”', 'Palavra-passe de «{0}»', '“{0}” 的密码', '「{0}」のパスワード'],
  ['Channel „{0}“ bearbeiten', 'Edit channel “{0}”', 'Editar canal «{0}»', 'Изменить канал «{0}»', 'Rediger kanal „{0}“', 'Redigera kanal ”{0}”', 'Editar canal «{0}»', '编辑频道“{0}”', 'チャンネル「{0}」を編集'],
  ['Unterchannel von „{0}“ erstellen', 'Create sub-channel of “{0}”', 'Crear subcanal de «{0}»', 'Создать подканал в «{0}»', 'Opret underkanal af „{0}“', 'Skapa underkanal till ”{0}”', 'Criar subcanal de «{0}»', '创建“{0}”的子频道', '「{0}」のサブチャンネルを作成'],
  ['Channel „{0}“ löschen?', 'Delete channel “{0}”?', '¿Eliminar canal «{0}»?', 'Удалить канал «{0}»?', 'Slet kanal „{0}“?', 'Ta bort kanal ”{0}”?', 'Eliminar canal «{0}»?', '删除频道“{0}”？', 'チャンネル「{0}」を削除しますか？'],
  ['{0} anstupsen', 'Poke {0}', 'Dar un toque a {0}', 'Ткнуть {0}', 'Prik {0}', 'Peta {0}', 'Cutucar {0}', '戳一下 {0}', '{0} をつつく'],
  ['{0} bannen', 'Ban {0}', 'Banear a {0}', 'Забанить {0}', 'Ban {0}', 'Bannlys {0}', 'Banir {0}', '封禁 {0}', '{0} を BAN'],
  ['{0} vom Server werfen', 'Kick {0} from server', 'Expulsar a {0} del servidor', 'Выгнать {0} с сервера', 'Smid {0} ud af serveren', 'Sparka {0} från servern', 'Expulsar {0} do servidor', '将 {0} 踢出服务器', '{0} をサーバーからキック'],
  ['{0} aus dem Channel werfen', 'Kick {0} from channel', 'Expulsar a {0} del canal', 'Выгнать {0} из канала', 'Smid {0} ud af kanalen', 'Sparka {0} från kanalen', 'Expulsar {0} do canal', '将 {0} 踢出频道', '{0} をチャンネルからキック'],
  ['Icon für „{0}“', 'Icon for “{0}”', 'Icono de «{0}»', 'Значок для «{0}»', 'Ikon til „{0}“', 'Ikon för ”{0}”', 'Ícone de «{0}»', '“{0}” 的图标', '「{0}」のアイコン'],
  ['Gruppe „{0}“ umbenennen', 'Rename group “{0}”', 'Renombrar grupo «{0}»', 'Переименовать группу «{0}»', 'Omdøb gruppe „{0}“', 'Byt namn på grupp ”{0}”', 'Renomear grupo «{0}»', '重命名群组“{0}”', 'グループ「{0}」の名前を変更'],
  ['Gruppe „{0}“ löschen?', 'Delete group “{0}”?', '¿Eliminar grupo «{0}»?', 'Удалить группу «{0}»?', 'Slet gruppe „{0}“?', 'Ta bort grupp ”{0}”?', 'Eliminar grupo «{0}»?', '删除群组“{0}”？', 'グループ「{0}」を削除しますか？'],
  ['Gruppe „{0}“ kopieren', 'Copy group “{0}”', 'Copiar grupo «{0}»', 'Копировать группу «{0}»', 'Kopiér gruppe „{0}“', 'Kopiera grupp ”{0}”', 'Copiar grupo «{0}»', '复制群组“{0}”', 'グループ「{0}」をコピー'],
  ['Servergruppe #{0}', 'Server group #{0}', 'Grupo del servidor #{0}', 'Группа сервера #{0}', 'Servergruppe #{0}', 'Servergrupp #{0}', 'Grupo do servidor #{0}', '服务器群组 #{0}', 'サーバーグループ #{0}'],
  ['Channelgruppe #{0}', 'Channel group #{0}', 'Grupo del canal #{0}', 'Группа канала #{0}', 'Kanalgruppe #{0}', 'Kanalgrupp #{0}', 'Grupo do canal #{0}', '频道群组 #{0}', 'チャンネルグループ #{0}'],
  // messages from the connection engine / server
  ['Verbunden mit „{0}“ als Client {1}', 'Connected to “{0}” as client {1}', 'Conectado a «{0}» como cliente {1}', 'Подключено к «{0}» как клиент {1}', 'Forbundet til „{0}“ som klient {1}', 'Ansluten till ”{0}” som klient {1}', 'Ligado a «{0}» como cliente {1}', '已作为客户端 {1} 连接到“{0}”', '「{0}」にクライアント {1} として接続しました'],
  ['Channel „{0}“ erstellt von {1}', 'Channel “{0}” created by {1}', 'Canal «{0}» creado por {1}', 'Канал «{0}» создан {1}', 'Kanal „{0}“ oprettet af {1}', 'Kanal ”{0}” skapad av {1}', 'Canal «{0}» criado por {1}', '频道“{0}”由 {1} 创建', 'チャンネル「{0}」が {1} により作成されました'],
  ['Channel „{0}“ bearbeitet von {1}', 'Channel “{0}” edited by {1}', 'Canal «{0}» editado por {1}', 'Канал «{0}» изменён {1}', 'Kanal „{0}“ redigeret af {1}', 'Kanal ”{0}” redigerad av {1}', 'Canal «{0}» editado por {1}', '频道“{0}”由 {1} 编辑', 'チャンネル「{0}」が {1} により編集されました'],
  ['Channel „{0}“ gelöscht', 'Channel “{0}” deleted', 'Canal «{0}» eliminado', 'Канал «{0}» удалён', 'Kanal „{0}“ slettet', 'Kanal ”{0}” borttagen', 'Canal «{0}» eliminado', '频道“{0}”已删除', 'チャンネル「{0}」を削除しました'],
  ['{0} hat sich verbunden (Channel „{1}“)', '{0} connected (channel “{1}”)', '{0} se ha conectado (canal «{1}»)', '{0} подключился (канал «{1}»)', '{0} har forbundet (kanal „{1}“)', '{0} anslöt (kanal ”{1}”)', '{0} ligou-se (canal «{1}»)', '{0} 已连接（频道“{1}”）', '{0} が接続しました（チャンネル「{1}」）'],
  ['{0} hat die Verbindung verloren', '{0} lost the connection', '{0} perdió la conexión', '{0} потерял соединение', '{0} mistede forbindelsen', '{0} tappade anslutningen', '{0} perdeu a ligação', '{0} 失去连接', '{0} の接続が切れました'],
  ['{0} wurde von {1} gekickt ({2})', '{0} was kicked by {1} ({2})', '{0} fue expulsado por {1} ({2})', '{0} выгнан {1} ({2})', '{0} blev smidt ud af {1} ({2})', '{0} sparkades av {1} ({2})', '{0} foi expulso por {1} ({2})', '{0} 被 {1} 踢出（{2}）', '{0} は {1} にキックされました（{2}）'],
  ['{0} wurde von {1} gebannt ({2})', '{0} was banned by {1} ({2})', '{0} fue baneado por {1} ({2})', '{0} забанен {1} ({2})', '{0} blev bannet af {1} ({2})', '{0} bannlystes av {1} ({2})', '{0} foi banido por {1} ({2})', '{0} 被 {1} 封禁（{2}）', '{0} は {1} に BAN されました（{2}）'],
  ['{0} hat den Server verlassen ({1})', '{0} left the server ({1})', '{0} salió del servidor ({1})', '{0} покинул сервер ({1})', '{0} forlod serveren ({1})', '{0} lämnade servern ({1})', '{0} saiu do servidor ({1})', '{0} 离开了服务器（{1}）', '{0} がサーバーを退出しました（{1}）'],
  ['{0} hat den Server verlassen', '{0} left the server', '{0} salió del servidor', '{0} покинул сервер', '{0} forlod serveren', '{0} lämnade servern', '{0} saiu do servidor', '{0} 离开了服务器', '{0} がサーバーを退出しました'],
  ['{0} wurde von {1} aus dem Channel geworfen ({2})', '{0} was kicked from the channel by {1} ({2})', '{0} fue expulsado del canal por {1} ({2})', '{0} выгнан из канала {1} ({2})', '{0} blev smidt ud af kanalen af {1} ({2})', '{0} sparkades från kanalen av {1} ({2})', '{0} foi expulso do canal por {1} ({2})', '{0} 被 {1} 踢出频道（{2}）', '{0} は {1} によりチャンネルからキックされました（{2}）'],
  ['{0} wurde von {1} nach „{2}“ verschoben', '{0} was moved to “{2}” by {1}', '{0} fue movido a «{2}» por {1}', '{0} перемещён в «{2}» ({1})', '{0} blev flyttet til „{2}“ af {1}', '{0} flyttades till ”{2}” av {1}', '{0} foi movido para «{2}» por {1}', '{0} 被 {1} 移到“{2}”', '{0} は {1} により「{2}」へ移動されました'],
  ['{0} wechselte in den Channel „{1}“', '{0} switched to channel “{1}”', '{0} se cambió al canal «{1}»', '{0} перешёл в канал «{1}»', '{0} skiftede til kanal „{1}“', '{0} bytte till kanal ”{1}”', '{0} mudou para o canal «{1}»', '{0} 切换到频道“{1}”', '{0} がチャンネル「{1}」に移動しました'],
  ['{0} heißt jetzt {1}', '{0} is now called {1}', '{0} ahora se llama {1}', '{0} теперь {1}', '{0} hedder nu {1}', '{0} heter nu {1}', '{0} chama-se agora {1}', '{0} 改名为 {1}', '{0} は {1} に名前を変えました'],
  ['{0} ist jetzt „{1}“ (durch {2})', '{0} is now “{1}” (by {2})', '{0} ahora es «{1}» (por {2})', '{0} теперь «{1}» ({2})', '{0} er nu „{1}“ (af {2})', '{0} är nu ”{1}” (av {2})', '{0} é agora «{1}» (por {2})', '{0} 现在是“{1}”（由 {2}）', '{0} は「{1}」になりました（{2} による）'],
  ['{0} wurde von {1} zur Servergruppe „{2}“ hinzugefügt', '{0} was added to server group “{2}” by {1}', '{0} fue añadido al grupo «{2}» por {1}', '{0} добавлен в группу «{2}» ({1})', '{0} blev tilføjet til servergruppen „{2}“ af {1}', '{0} lades till i servergruppen ”{2}” av {1}', '{0} foi adicionado ao grupo «{2}» por {1}', '{0} 被 {1} 加入服务器群组“{2}”', '{0} は {1} によりサーバーグループ「{2}」に追加されました'],
  ['{0} wurde von {1} aus der Servergruppe „{2}“ entfernt', '{0} was removed from server group “{2}” by {1}', '{0} fue quitado del grupo «{2}» por {1}', '{0} удалён из группы «{2}» ({1})', '{0} blev fjernet fra servergruppen „{2}“ af {1}', '{0} togs bort från servergruppen ”{2}” av {1}', '{0} foi removido do grupo «{2}» por {1}', '{0} 被 {1} 移出服务器群组“{2}”', '{0} は {1} によりサーバーグループ「{2}」から外されました'],
  ['{0} stupst dich an: {1}', '{0} pokes you: {1}', '{0} te da un toque: {1}', '{0} тыкает вас: {1}', '{0} prikker dig: {1}', '{0} petar dig: {1}', '{0} cutuca-te: {1}', '{0} 戳了你：{1}', '{0} があなたをつつきました: {1}'],
  ['Servereinstellungen geändert von {0}', 'Server settings changed by {0}', 'Ajustes del servidor cambiados por {0}', 'Настройки сервера изменены {0}', 'Serverindstillinger ændret af {0}', 'Serverinställningar ändrade av {0}', 'Definições do servidor alteradas por {0}', '服务器设置已由 {0} 更改', 'サーバー設定が {0} により変更されました'],
  ['Identität {0} (Level {1})', 'Identity {0} (level {1})', 'Identidad {0} (nivel {1})', 'Личность {0} (уровень {1})', 'Identitet {0} (niveau {1})', 'Identitet {0} (nivå {1})', 'Identidade {0} (nível {1})', '身份 {0}（等级 {1}）', 'ID {0}（レベル {1}）'],
  ['Willkommensnachricht: {0}', 'Welcome message: {0}', 'Mensaje de bienvenida: {0}', 'Приветствие: {0}', 'Velkomstbesked: {0}', 'Välkomstmeddelande: {0}', 'Mensagem de boas-vindas: {0}', '欢迎消息：{0}', 'ウェルカムメッセージ: {0}'],
  ['Fehler: {0} ({1}, id {2})', 'Error: {0} ({1}, id {2})', 'Error: {0} ({1}, id {2})', 'Ошибка: {0} ({1}, id {2})', 'Fejl: {0} ({1}, id {2})', 'Fel: {0} ({1}, id {2})', 'Erro: {0} ({1}, id {2})', '错误：{0}（{1}，id {2}）', 'エラー: {0}（{1}、id {2}）'],
  ['Verbindung beendet: {0}', 'Connection closed: {0}', 'Conexión cerrada: {0}', 'Соединение закрыто: {0}', 'Forbindelse afsluttet: {0}', 'Anslutningen avslutad: {0}', 'Ligação terminada: {0}', '连接已结束：{0}', '接続終了: {0}'],
  ['Verbindung fehlgeschlagen: {0}', 'Connection failed: {0}', 'Conexión fallida: {0}', 'Ошибка подключения: {0}', 'Forbindelse mislykkedes: {0}', 'Anslutningen misslyckades: {0}', 'Falha na ligação: {0}', '连接失败：{0}', '接続に失敗しました: {0}'],
  ['Getrennt: {0}', 'Disconnected: {0}', 'Desconectado: {0}', 'Отключено: {0}', 'Afbrudt: {0}', 'Frånkopplad: {0}', 'Desligado: {0}', '已断开：{0}', '切断されました: {0}'],
  ['getrennt ({0})', 'disconnected ({0})', 'desconectado ({0})', 'отключено ({0})', 'afbrudt ({0})', 'frånkopplad ({0})', 'desligado ({0})', '已断开（{0}）', '切断（{0}）'],
  ['vom Server gekickt von {0}: {1}', 'kicked from the server by {0}: {1}', 'expulsado del servidor por {0}: {1}', 'выгнан с сервера {0}: {1}', 'smidt ud af serveren af {0}: {1}', 'sparkad från servern av {0}: {1}', 'expulso do servidor por {0}: {1}', '被 {0} 踢出服务器：{1}', '{0} によりサーバーからキック: {1}'],
  ['vom Server gebannt von {0}: {1}', 'banned from the server by {0}: {1}', 'baneado del servidor por {0}: {1}', 'забанен на сервере {0}: {1}', 'bannet fra serveren af {0}: {1}', 'bannlyst från servern av {0}: {1}', 'banido do servidor por {0}: {1}', '被 {0} 封禁：{1}', '{0} によりサーバーから BAN: {1}'],
  ['Löse {0} auf ...', 'Resolving {0} ...', 'Resolviendo {0} ...', 'Определение адреса {0} ...', 'Slår {0} op ...', 'Slår upp {0} ...', 'A resolver {0} ...', '正在解析 {0} ...', '{0} を解決中 ...'],
  ['Verbinde mit {0} ...', 'Connecting to {0} ...', 'Conectando a {0} ...', 'Подключение к {0} ...', 'Forbinder til {0} ...', 'Ansluter till {0} ...', 'A ligar a {0} ...', '正在连接到 {0} ...', '{0} に接続中 ...'],
  ['Erzeuge Identität (Sicherheitslevel {0}) ...', 'Creating identity (security level {0}) ...', 'Creando identidad (nivel de seguridad {0}) ...', 'Создание личности (уровень {0}) ...', 'Opretter identitet (sikkerhedsniveau {0}) ...', 'Skapar identitet (säkerhetsnivå {0}) ...', 'A criar identidade (nível {0}) ...', '正在创建身份（安全等级 {0}）...', 'ID を作成中（セキュリティレベル {0}）...'],
  ['Sicherheitslevel jetzt {0}', 'Security level is now {0}', 'Nivel de seguridad ahora {0}', 'Уровень безопасности теперь {0}', 'Sikkerhedsniveau nu {0}', 'Säkerhetsnivå nu {0}', 'Nível de segurança agora {0}', '安全等级现在为 {0}', 'セキュリティレベルは {0} になりました'],
  ['Berechne Level {0} … (die Verbindung bleibt bestehen)', 'Computing level {0} … (the connection stays open)', 'Calculando nivel {0} … (la conexión se mantiene)', 'Вычисление уровня {0} … (соединение сохраняется)', 'Beregner niveau {0} … (forbindelsen bevares)', 'Beräknar nivå {0} … (anslutningen behålls)', 'A calcular nível {0} … (a ligação mantém-se)', '正在计算等级 {0} …（连接保持不变）', 'レベル {0} を計算中 …（接続は維持されます）'],
  // broad pattern last, so specific ones (e.g. "Löse {0} auf ...") win
  ['{0} auf {1}', '{0} on {1}', '{0} en {1}', '{0} на {1}', '{0} på {1}', '{0} på {1}', '{0} em {1}', '{0}（{1}）', '{0}（{1}）'],
];

const I18N_PHRASES_EXTRA = [
  ['Zeitüberschreitung beim Verbindungsaufbau', 'Connection attempt timed out', 'Tiempo de conexión agotado', 'Время подключения истекло', 'Forbindelsesforsøget fik timeout', 'Anslutningsförsöket tog för lång tid', 'Tempo de ligação esgotado', '连接超时', '接続がタイムアウトしました'],
  ['Verbindung verloren (Timeout)', 'Connection lost (timeout)', 'Conexión perdida (tiempo agotado)', 'Соединение потеряно (таймаут)', 'Forbindelse mistet (timeout)', 'Anslutningen förlorad (timeout)', 'Ligação perdida (tempo esgotado)', '连接丢失（超时）', '接続が切れました（タイムアウト）'],
  ['Server antwortet nicht mehr', 'Server stopped responding', 'El servidor ya no responde', 'Сервер не отвечает', 'Serveren svarer ikke længere', 'Servern svarar inte längre', 'O servidor deixou de responder', '服务器无响应', 'サーバーが応答しません'],
  ['Neu verbinden in 5 Sekunden …', 'Reconnecting in 5 seconds …', 'Reconectando en 5 segundos …', 'Переподключение через 5 секунд …', 'Genforbinder om 5 sekunder …', 'Återansluter om 5 sekunder …', 'A religar em 5 segundos …', '5 秒后重新连接 …', '5 秒後に再接続します …'],
  ['Hinweis: Server nutzt eine eigene Lizenz-Root (keine offizielle TeamSpeak-Lizenz)', 'Note: the server uses its own license root (no official TeamSpeak license)', 'Nota: el servidor usa su propia raíz de licencia (sin licencia oficial)', 'Примечание: сервер использует собственный корень лицензии (не официальная лицензия)', 'Bemærk: serveren bruger sin egen licensrod (ingen officiel licens)', 'Obs: servern använder en egen licensrot (ingen officiell licens)', 'Nota: o servidor usa a sua própria raiz de licença (sem licença oficial)', '注意：服务器使用自己的许可证根（非官方 TeamSpeak 许可证）', '注意: サーバーは独自のライセンスルートを使用しています（公式ライセンスではありません）'],
];

// Voice announcements per language (key = sound key)
const SOUND_I18N = {
  connected: ['Verbunden', 'Connected', 'Conectado', 'Подключено', 'Forbundet', 'Ansluten', 'Ligado', '已连接', '接続しました'],
  disconnected: ['Verbindung getrennt', 'Disconnected', 'Desconectado', 'Отключено', 'Forbindelse afbrudt', 'Frånkopplad', 'Desligado', '已断开连接', '切断しました'],
  connection_lost: ['Verbindung verloren', 'Connection lost', 'Conexión perdida', 'Соединение потеряно', 'Forbindelse mistet', 'Anslutningen förlorad', 'Ligação perdida', '连接丢失', '接続が切れました'],
  connect_failed: ['Verbindung fehlgeschlagen', 'Connection failed', 'Conexión fallida', 'Ошибка подключения', 'Forbindelse mislykkedes', 'Anslutningen misslyckades', 'Falha na ligação', '连接失败', '接続に失敗しました'],
  kicked_server: ['Du wurdest vom Server geworfen', 'You were kicked from the server', 'Te expulsaron del servidor', 'Вас выгнали с сервера', 'Du blev smidt ud af serveren', 'Du sparkades från servern', 'Foste expulso do servidor', '你被踢出了服务器', 'サーバーからキックされました'],
  banned: ['Du wurdest gebannt', 'You were banned', 'Te banearon', 'Вас забанили', 'Du blev bannet', 'Du har bannlysts', 'Foste banido', '你被封禁了', 'BAN されました'],
  channel_switched: ['Channel gewechselt', 'Channel switched', 'Canal cambiado', 'Канал сменён', 'Kanal skiftet', 'Kanal bytt', 'Canal alterado', '已切换频道', 'チャンネルを移動しました'],
  you_were_moved: ['Du wurdest verschoben', 'You were moved', 'Te movieron', 'Вас переместили', 'Du blev flyttet', 'Du flyttades', 'Foste movido', '你被移动了', '移動されました'],
  you_kicked_channel: ['Du wurdest aus dem Channel geworfen', 'You were kicked from the channel', 'Te expulsaron del canal', 'Вас выгнали из канала', 'Du blev smidt ud af kanalen', 'Du sparkades från kanalen', 'Foste expulso do canal', '你被踢出了频道', 'チャンネルからキックされました'],
  user_joined_channel: ['Benutzer hat deinen Channel betreten', 'User joined your channel', 'Un usuario entró a tu canal', 'Пользователь вошёл в ваш канал', 'Bruger gik ind i din kanal', 'Användare gick med i din kanal', 'Utilizador entrou no seu canal', '有用户进入了你的频道', 'ユーザーがチャンネルに参加しました'],
  user_left_channel: ['Benutzer hat deinen Channel verlassen', 'User left your channel', 'Un usuario salió de tu canal', 'Пользователь покинул ваш канал', 'Bruger forlod din kanal', 'Användare lämnade din kanal', 'Utilizador saiu do seu canal', '有用户离开了你的频道', 'ユーザーがチャンネルを退出しました'],
  user_kicked_channel: ['Benutzer wurde aus dem Channel geworfen', 'User was kicked from the channel', 'Un usuario fue expulsado del canal', 'Пользователя выгнали из канала', 'Bruger blev smidt ud af kanalen', 'Användare sparkades från kanalen', 'Utilizador expulso do canal', '用户被踢出频道', 'ユーザーがチャンネルからキックされました'],
  user_kicked_server: ['Benutzer wurde vom Server geworfen', 'User was kicked from the server', 'Un usuario fue expulsado del servidor', 'Пользователя выгнали с сервера', 'Bruger blev smidt ud af serveren', 'Användare sparkades från servern', 'Utilizador expulso do servidor', '用户被踢出服务器', 'ユーザーがサーバーからキックされました'],
  user_banned: ['Benutzer wurde gebannt', 'User was banned', 'Un usuario fue baneado', 'Пользователя забанили', 'Bruger blev bannet', 'Användare bannlystes', 'Utilizador banido', '用户被封禁', 'ユーザーが BAN されました'],
  user_lost_connection: ['Benutzer hat die Verbindung verloren', 'User lost connection', 'Un usuario perdió la conexión', 'Пользователь потерял соединение', 'Bruger mistede forbindelsen', 'Användare tappade anslutningen', 'Utilizador perdeu a ligação', '用户失去连接', 'ユーザーの接続が切れました'],
  user_connected: ['Benutzer verbunden', 'User connected', 'Usuario conectado', 'Пользователь подключился', 'Bruger forbundet', 'Användare ansluten', 'Utilizador ligado', '用户已连接', 'ユーザーが接続しました'],
  user_disconnected: ['Benutzer hat den Server verlassen', 'User left the server', 'Un usuario salió del servidor', 'Пользователь покинул сервер', 'Bruger forlod serveren', 'Användare lämnade servern', 'Utilizador saiu do servidor', '用户离开了服务器', 'ユーザーがサーバーを退出しました'],
  poked: ['Du wurdest angestupst', 'You were poked', 'Te dieron un toque', 'Вас ткнули', 'Du blev prikket', 'Du blev petad', 'Foste cutucado', '你被戳了一下', 'つつかれました'],
  group_assigned: ['Servergruppe zugewiesen', 'Server group assigned', 'Grupo del servidor asignado', 'Группа сервера назначена', 'Servergruppe tildelt', 'Servergrupp tilldelad', 'Grupo do servidor atribuído', '已分配服务器群组', 'サーバーグループが割り当てられました'],
  group_removed: ['Servergruppe entfernt', 'Server group removed', 'Grupo del servidor retirado', 'Группа сервера снята', 'Servergruppe fjernet', 'Servergrupp borttagen', 'Grupo do servidor removido', '已移除服务器群组', 'サーバーグループが外されました'],
  channelgroup_assigned: ['Channelgruppe zugewiesen', 'Channel group assigned', 'Grupo del canal asignado', 'Группа канала назначена', 'Kanalgruppe tildelt', 'Kanalgrupp tilldelad', 'Grupo do canal atribuído', '已分配频道群组', 'チャンネルグループが割り当てられました'],
  mic_muted: ['Mikrofon stummgeschaltet', 'Microphone muted', 'Micrófono silenciado', 'Микрофон выключен', 'Mikrofon slået fra', 'Mikrofon avstängd', 'Microfone silenciado', '麦克风已静音', 'マイクをミュートしました'],
  mic_unmuted: ['Mikrofon aktiviert', 'Microphone activated', 'Micrófono activado', 'Микрофон включён', 'Mikrofon aktiveret', 'Mikrofon aktiverad', 'Microfone ativado', '麦克风已开启', 'マイクを有効にしました'],
  sound_muted: ['Lautsprecher stummgeschaltet', 'Speakers muted', 'Altavoces silenciados', 'Динамики выключены', 'Højttalere slået fra', 'Högtalare avstängda', 'Altifalantes silenciados', '扬声器已静音', 'スピーカーをミュートしました'],
  sound_unmuted: ['Lautsprecher aktiviert', 'Speakers activated', 'Altavoces activados', 'Динамики включены', 'Højttalere aktiveret', 'Högtalare aktiverade', 'Altifalantes ativados', '扬声器已开启', 'スピーカーを有効にしました'],
  away: ['Abwesend', 'Away', 'Ausente', 'Отошёл', 'Væk', 'Borta', 'Ausente', '离开', '離席'],
  back: ['Wieder da', 'Back', 'De vuelta', 'Снова здесь', 'Tilbage', 'Tillbaka', 'De volta', '回来了', '戻りました'],
  mic_muted_hint: ['Dein Mikrofon ist stummgeschaltet', 'Your microphone is muted', 'Tu micrófono está silenciado', 'Ваш микрофон выключен', 'Din mikrofon er slået fra', 'Din mikrofon är avstängd', 'O seu microfone está silenciado', '你的麦克风已静音', 'マイクがミュートになっています'],
};

// ================================================================== engine

let LANG = 'de';
let I18N_MAP = new Map();
let I18N_RX = [];
const I18N_ORIG = new WeakMap(); // text node -> original German text
const I18N_ATTR = new WeakMap(); // element -> {attr: original}
const I18N_SKIP = '.node .name, .who, .desc, .token, code, .sp-text, .sp-fill, .gname, .gname-tag, .away-msg, [data-notr], #server-title, .pg-title b, .stab .name, .msg:not(.info):not(.error):not(.poke) .body, .perm-members, script, style, textarea';

function escRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setLanguage(lang) {
  LANG = LANGS[lang] ? lang : 'de';
  document.documentElement.lang = LANG;
  const i = LANG_ORDER.indexOf(LANG);
  I18N_MAP = new Map();
  I18N_RX = [];
  if (LANG !== 'de') {
    for (const row of [...I18N_ROWS, ...I18N_PHRASES_EXTRA]) if (row[i]) I18N_MAP.set(row[0], row[i]);
    for (const row of I18N_PATTERNS) {
      const src = row[0];
      const rx = new RegExp('^' + escRx(src).replace(/\\\{(\d)\\\}/g, '(.+?)') + '$', 's');
      I18N_RX.push([rx, row[i], src]);
    }
  }
  translateAll();
}

/** Translate one string (exact phrase, then patterns). */
function tr(text) {
  if (LANG === 'de' || !text) return text;
  const t = text.trim();
  if (!t) return text;
  const hit = I18N_MAP.get(t);
  if (hit) return text.replace(t, hit);
  for (const [rx, target] of I18N_RX) {
    const m = rx.exec(t);
    if (!m) continue;
    const out = target.replace(/\{(\d)\}/g, (_, n) => tr(m[Number(n) + 1] ?? ''));
    return text.replace(t, out);
  }
  return text;
}

let I18N_BUSY = false;

function translateTextNode(n) {
  const p = n.parentElement;
  if (!p || p.closest(I18N_SKIP)) return;
  let orig = I18N_ORIG.get(n);
  const cur = n.nodeValue;
  // A changed node (re-rendered text) gets a new original
  if (orig === undefined || (cur !== orig && cur !== n.__tr)) orig = cur;
  I18N_ORIG.set(n, orig);
  const out = tr(orig);
  n.__tr = out;
  if (out !== cur) n.nodeValue = out;
}

function translateAttrs(el) {
  if (el.closest?.(I18N_SKIP)) return;
  for (const a of ['title', 'placeholder']) {
    if (!el.hasAttribute?.(a)) continue;
    let rec = I18N_ATTR.get(el) || {};
    const cur = el.getAttribute(a);
    if (rec[a] === undefined || (cur !== rec[a] && cur !== rec['__' + a])) rec[a] = cur;
    const out = tr(rec[a]);
    rec['__' + a] = out;
    I18N_ATTR.set(el, rec);
    if (out !== cur) el.setAttribute(a, out);
  }
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return translateTextNode(root);
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) translateTextNode(n);
    else translateAttrs(n);
  }
}

function translateAll() {
  I18N_BUSY = true;
  translateTree(document.body);
  I18N_BUSY = false;
}

new MutationObserver(muts => {
  if (I18N_BUSY || LANG === 'de') return;
  I18N_BUSY = true;
  for (const m of muts) {
    if (m.type === 'characterData') translateTextNode(m.target);
    else if (m.type === 'attributes') translateAttrs(m.target);
    else m.addedNodes.forEach(translateTree);
  }
  I18N_BUSY = false;
}).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });

// Voice announcements in the selected language
const _speak = Sounds.speak.bind(Sounds);
Sounds.play = function (key) {
  if (this.cfg.mode === 'off') return;
  if ((key === 'user_connected' || key === 'user_disconnected') && !this.cfg.serverEvents) return;
  if ((key === 'message_channel' || key === 'message_server') && !this.cfg.messages) return;
  if (this.cfg.mode === 'pack' && this.playFile(key)) return;
  const i = LANG_ORDER.indexOf(LANG);
  const text = SOUND_TEXT[key] === null ? null : (SOUND_I18N[key]?.[i] || SOUND_TEXT[key]);
  if (this.cfg.mode !== 'tones' && text && window.speechSynthesis) this.speak(text);
  else if (TONES[key]) this.tone(TONES[key]);
};
Sounds.speak = function (text) {
  const u = new SpeechSynthesisUtterance(text);
  const want = SPEECH_LANG[LANG].toLowerCase();
  const all = window.speechSynthesis.getVoices();
  const v = all.find(v => v.name === this.cfg.voice && v.lang?.toLowerCase().startsWith(want.slice(0, 2)))
    || all.find(v => v.lang?.toLowerCase() === want)
    || all.find(v => v.lang?.toLowerCase().startsWith(want.slice(0, 2)));
  if (v) u.voice = v;
  u.lang = v?.lang || SPEECH_LANG[LANG];
  u.volume = this.cfg.volume;
  u.rate = 1.1;
  if (speechSynthesis.speaking && speechSynthesis.pending) speechSynthesis.cancel();
  speechSynthesis.speak(u);
};
void _speak;

setLanguage(UI.app.language || 'de');
