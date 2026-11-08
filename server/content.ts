/** Public seed content only. NEVER place any access answers or admin secrets here. */
export const sectionsSeed = [
  {
    slug: 'family', label: 'Family', chapter: 'I', title: 'A Letter of Love',
    subtitle: 'For the ones who made every universe feel like home.',
    letter: "Gia đình mình mãi hạnh phúc nhée, I'll be the part of it in every universe",
    question: 'Mật khẩu wifi của nhà Trí là gì?',
    intro: 'There is no place like the love we call family.',
    music_url: '/audio/family.wav'
  },
  {
    slug: 'high-school', label: 'High School', chapter: 'II', title: 'The Days We Keep',
    subtitle: 'A scrapbook of the days we never want to lose.',
    letter: 'Tui cũng mún có thư tay <3, tui cũng mún có sinh nhật bất ngờ như năm ngoái!! Năm ngoái quá đỉnk lun í, arigatou kakegurui mashooo~~~',
    question: 'Món đồ mà Trí bị lấy mất đến giờ vẫn khao khát lấy lại đó là gì?',
    intro: 'Some days end. The stories we made in them never do.',
    music_url: '/audio/school.wav'
  },
  {
    slug: 'university', label: 'University Friend', chapter: 'III', title: "The Fool’s Journey",
    subtitle: 'The stars have only just begun writing our story.',
    letter: 'Không ngờ lên đại học lại gặp được người mean và hợp như cặu, kh có cặu chắc học đại học bùn lắm íii <33',
    question: 'Người mà Thiên Trí đã giặt đồ chung lần cuối cùng trong kì quân sự là ai?',
    intro: 'A new chapter, a new sky, and the beautiful unknown.',
    music_url: '/audio/university.wav'
  }
] as const;

// Shared canonical_key values intentionally link duplicate wishes across all three groups.
export const giftsSeed: Record<string, Array<[string,string,string,string,string]>> = {
  family: [
    ['necklace-men', 'Dây chuyền nam', 'Một chiếc dây chuyền nam có thiết kế tinh tế.', 'Chọn kiểu dáng phù hợp để Trí có thể đeo thường ngày.', '✧'],
    ['mini-camera', 'Máy ảnh mini', 'Chiếc máy ảnh nhỏ gọn lưu lại những khoảnh khắc đáng nhớ.', 'Ưu tiên thiết kế tiện mang theo.', '📷'],
    ['pocket-camera', 'Pocket (thiết bị quay video...)', 'Thiết bị quay video cầm tay, nhỏ gọn để ghi lại những câu chuyện.', 'Pocket là thiết bị quay video, không phải túi đựng.', '🎥'],
    ['iphone-18-pro-max', 'iPhone 18 Pro Max', 'Mong muốn dành cho một chiếc iPhone 18 Pro Max.', 'Mẫu máy và thời điểm bán cần kiểm tra trước khi mua.', '✦'],
    ['boardgame-unique', 'Boardgame độc đáo như Faraway, Splendor,...', 'Một trò chơi bàn thú vị để mọi người quây quần bên nhau.', 'Gợi ý: Faraway, Splendor hoặc một boardgame độc đáo khác.', '♟'],
    ['chess-wooden', 'Bộ cờ vua bằng gỗ độc lạ', 'Một bộ cờ vua bằng gỗ có thiết kế mang tính nghệ thuật.', 'Ưu tiên vẻ đẹp độc lạ của chất liệu gỗ.', '♜']
  ],
  'high-school': [
    ['tarot-deck', 'Bài tarot đẹp, họa tiết độc lạ, sặc sỡ', 'Một bộ bài tarot nhiều màu sắc và có minh họa khác biệt.', 'Ưu tiên bộ bài với artwork độc đáo.', '☽'],
    ['school-memory-book', 'Lưu bút của Thiên Trí', 'Một cuốn lưu bút tràn đầy câu chuyện, chữ viết và kỷ niệm.', 'Những lời viết tay là phần đặc biệt nhất.', '✎'],
    ['corn-cake', 'Bánh kem bắp', 'Chiếc bánh kem bắp cho buổi sinh nhật thật vui.', 'Một món quà ngọt ngào để cùng chia sẻ.', '🎂'],
    ['power-bank', 'Sạc dự phòng có dây sẵn', 'Pin sạc dự phòng tích hợp dây sạc.', 'Nhớ kiểm tra cổng sạc tương thích.', '⚡'],
    ['cocoon-micellar', 'Nước tẩy trang Cocoon big size', 'Nước tẩy trang Cocoon dung tích lớn.', 'Kiểm tra dòng sản phẩm và dung tích trước khi mua.', '❀'],
    ['boardgame-unique', 'Boardgame độc đáo như Faraway, Splendor', 'Boardgame dành cho những buổi tụ họp vui vẻ.', 'Faraway, Splendor hoặc boardgame độc đáo khác.', '♟'],
    ['chess-wooden', 'Bộ cờ vua bằng gỗ độc lạ', 'Bộ cờ vua bằng gỗ mang phong cách đặc biệt.', 'Một thiết kế càng nghệ thuật càng thú vị.', '♜'],
    ['reverse-pass-x3', 'Gói x3 thẻ tháng Reverse: 1999', 'Ba thẻ tháng dành cho trò chơi Reverse: 1999.', 'Kiểm tra tài khoản/máy chủ và cách tặng hợp lệ.', '✴'],
    ['identity-skins', 'Skin A/S Mechanic, Mary, Geisha, Thư Kí và các nhân vật Identity V', 'Trang phục cấp A/S cho các nhân vật Identity V.', 'Nhân vật gợi ý: Mechanic, Mary, Geisha, Thư Kí và các nhân vật khác.', '♢'],
    ['popmart-idv', 'Pop Mart x Identity V', 'Vật phẩm sưu tầm từ bộ sưu tập Pop Mart x Identity V.', 'Chọn mẫu nhân vật thật dễ thương.', '♡'],
    ['reverse-merch', 'Merchandise Reverse: 1999', 'Đồ lưu niệm, phụ kiện hoặc vật phẩm sưu tầm Reverse: 1999.', 'Hình minh họa sẽ được cập nhật sau.', '☼'],
    ['mini-camera', 'Camera mini', 'Một chiếc camera nhỏ xinh để lưu giữ kỷ niệm.', 'Được liên kết trạng thái với máy ảnh mini ở Family.', '📷'],
    ['chatgpt-plus', 'ChatGPT Plus', 'Gói dịch vụ ChatGPT Plus.', 'Cân nhắc cách tặng chính thức và tính phù hợp với tài khoản.', '✳']
  ],
  university: [
    ['skincare', 'Đồ skincare', 'Một món đồ chăm sóc da phù hợp.', 'Nên hỏi loại da và nhu cầu cụ thể trước khi chọn.', '✿'],
    ['lip-balm', 'Son dưỡng', 'Một thỏi son dưỡng dùng hằng ngày.', 'Ưu tiên chất son dễ dùng.', '♡'],
    ['popmart-idv', 'Pop Mart x Identity V', 'Đồ sưu tầm thuộc bộ Pop Mart x Identity V.', 'Được liên kết trạng thái với High School.', '♢'],
    ['reverse-merch', 'Merchandise Reverse: 1999', 'Phụ kiện và vật phẩm sưu tầm của Reverse: 1999.', 'Được liên kết trạng thái với High School.', '✴'],
    ['chatgpt-plus', 'ChatGPT Plus', 'Gói dịch vụ ChatGPT Plus.', 'Được liên kết trạng thái với High School.', '✳'],
    ['boardgame-unique', 'Boardgame độc đáo', 'Một boardgame độc lạ để thử cùng bạn bè.', 'Được liên kết trạng thái với Family và High School.', '♟'],
    ['animal-hat', 'Nón trắng hình mèo hoặc thỏ cuti', 'Một chiếc nón trắng với họa tiết mèo hoặc thỏ dễ thương.', 'Thiết kế đáng yêu là ưu tiên.', '🐈'],
    ['shirt', 'Áo sơ mi', 'Một chiếc áo sơ mi có kiểu dáng đẹp.', 'Hỏi số đo trước khi mua.', '♧'],
    ['wide-pants', 'Quần dài rộng', 'Một chiếc quần dáng rộng thoải mái.', 'Hỏi size và chiều dài trước khi mua.', '☾']
  ]
};

export const defaults: Record<string,string> = {
  'home.title': 'The Birthday Collection',
  'home.subtitle': 'A birthday wish, a little story, and every universe in between.',
  'profile.name': 'Thiên Trí',
  'profile.brand': 'ThinTreé',
  'profile.birthday': '03/12/2007',
  'profile.major': 'Công nghệ thông tin',
  'profile.zodiac': 'Nhân Mã',
  'profile.intro': 'Có những điều làm nên một người: những trận cầu bất chợt, thế giới game nhiệm màu, những thước phim và bài hát không cần cùng thể loại.',
  'profile.facts': 'Thích hát nhiều thể loại nhạc\nYêu những trò chơi có câu chuyện thú vị\nMuốn lưu lại khoảnh khắc qua ảnh và phim',
  'home.music_url': '/audio/intro.wav'
};

export const hobbyGroups = [
  { icon:'♧', label:'IN MOTION', title:'Sports', entries:['Cầu lông','Pickleball','Bóng bàn'] },
  { icon:'✦', label:'PLAYFUL DAYS', title:'Entertainment', entries:['Bowling','Gaming'] },
  { icon:'☼', label:'DIGITAL UNIVERSES', title:'Favorite games', entries:['Reverse: 1999','Genshin Impact','Honkai: Star Rail','Roblox','Identity V'] },
  { icon:'▣', label:'THE BIG SCREEN', title:'Cinema', entries:['Thích xem phim hay','Có hứng thú với làm phim'] },
  { icon:'♫', label:'ON REPEAT', title:'Music', entries:['Nhạc ngoại','Ballad','Vọng cổ','Dân ca kết hợp hiện đại','Nhạc truyền thống','Pop','Có thể hát nhiều thể loại'] }
];
