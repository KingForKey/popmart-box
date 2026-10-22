// 内置联想字典：泡泡玛特常见 IP / 热门系列 / 部分热门款式名。
// 数据来源为公开资料整理，仅用于输入联想，不影响手动输入；
// 后续迭代可以按需扩充（往数组里加字符串即可，结构不要变）。

// IP 列表：写法为「中文名（外文名）」或「外文名（中文别名）」，
// 这样无论用户输入中文还是英文都能联想命中。
export const IP_DICT = [
  'Molly（茉莉）',
  'Labubu（拉布布）',
  'Dimoo（迪莫）',
  'Skullpanda',
  'Hirono（小野）',
  'Crybaby（哭娃）',
  'Pucky（毕奇）',
  'Twinkle Twinkle（星星人）',
  'Pino Jelly',
  'Zsiga',
  'Hacipupu',
  'Sweet Bean（小甜豆）',
  'Azura',
  'Kubo',
  'Minico',
  'Bunny',
  'Yuki',
  'Faya',
  'Chaka',
  'Baby Molly',
  'Baby Dimoo',
  'The Monsters（精灵天团）',
  'Vita',
  'Gummy',
  'Rico',
  'Snoopy（史努比）',
  'Disney（迪士尼）'
]

// 按 IP 归组的热门系列（尽力收录，欢迎补充）
export const SERIES_BY_IP = {
  'Molly（茉莉）': [
    '周年纪念雕像系列',
    '魔法世界系列',
    '放空的一天系列',
    '我的小时候系列',
    '花·瞬间幻象系列',
    '守护甜心系列',
    '面包脑袋系列',
    '城市街景系列',
    'Molly 的一天系列',
    '当我三岁时系列'
  ],
  'Labubu（拉布布）': [
    '坐坐派对系列',
    '前方高能系列',
    '心动马卡龙系列',
    '乐园系列',
    '森林音乐会系列',
    '看不见我系列',
    '顽皮日记系列',
    '慵懒瑜伽系列',
    '象棋大冒险系列',
    '宇宙大冒险系列',
    '精灵天团系列'
  ],
  'Dimoo（迪莫）': [
    '约会日系列',
    '森林之夜系列',
    '一起去郊游系列',
    '恐龙世界系列',
    '猫猫乐园系列',
    '今晚不准睡系列',
    '在你身边系列',
    '梦里梦外系列',
    '星座系列',
    '迪士尼系列',
    '侏罗纪世界系列',
    '海洋馆系列'
  ],
  'Skullpanda': [
    '温度系列',
    '密林古堡系列',
    '夜之城系列',
    '人生如戏系列',
    '明日早高峰系列',
    '糖果怪物小镇系列',
    '梦游仙境系列',
    '雪国来信系列'
  ],
  'Hirono（小野）': [
    '小小的使坏系列',
    '庇护所系列',
    '重塑系列',
    '默剧系列',
    '幽灵熊系列',
    '洛可可系列'
  ],
  'Crybaby（哭娃）': [
    '怪兽的眼泪系列',
    '飞天小女警系列',
    '悲伤俱乐部系列',
    '彩虹系列'
  ],
  'Pucky（毕奇）': [
    '动物茶话会系列',
    '精灵游园会系列',
    '甜心乐园系列'
  ],
  'Twinkle Twinkle（星星人）': [
    '我们都是星星人系列',
    '来自星星的礼物系列',
    '随心配系列'
  ],
  'Pino Jelly': [
    '今天心情怎么样系列',
    '味觉性格测试系列'
  ],
  'Zsiga': [
    '双手插兜系列',
    '我们如此可爱系列',
    '森林漫步系列'
  ],
  'Hacipupu': [
    '幼稚园系列',
    '糖果屋系列',
    '森林奇遇系列',
    '奇幻之夜系列'
  ],
  'Sweet Bean（小甜豆）': [
    '超市系列',
    '美食街系列',
    '猫咪下午茶系列'
  ],
  'Azura': [
    '太空旅行系列',
    '春日幻想系列'
  ]
}

// 部分热门系列的款式名（收录把握较大的，宁缺毋滥）
export const STYLES_BY_SERIES = {
  '坐坐派对系列': ['美滋滋', '甜丝丝', '惊喜特摇', '委屈屈', '眼巴巴', '好希望'],
  '前方高能系列': ['前方高能·蓝', '前方高能·粉', '前方高能·绿'],
  '心动马卡龙系列': ['草莓马卡龙', '抹茶马卡龙', '香草马卡龙', '巧克力马卡龙'],
  '温度系列': ['暖冬', '盛夏', '初春', '深秋'],
  '小小的使坏系列': ['偷偷看你', '搞点事情', '装无辜', '躲猫猫'],
  '魔法世界系列': ['魔法师 Molly', '见习女巫', '水晶球']
}

// 把字典打平：全部系列名（用于没选 IP 时的兜底联想）
export const ALL_SERIES = Object.keys(SERIES_BY_IP).reduce((acc, ip) => {
  for (const s of SERIES_BY_IP[ip]) if (acc.indexOf(s) < 0) acc.push(s)
  return acc
}, [])

// 全部款式名打平（兜底联想）
export const ALL_STYLES = Object.keys(STYLES_BY_SERIES).reduce((acc, s) => {
  for (const n of STYLES_BY_SERIES[s]) if (acc.indexOf(n) < 0) acc.push(n)
  return acc
}, [])

// 根据用户输入的 IP 文本（可能是中文别名或英文）匹配字典里的 IP 条目。
// 命中返回字典条目字符串，未命中返回 null。
export function matchIp(input) {
  const q = String(input || '').trim().toLowerCase()
  if (!q) return null
  for (const entry of IP_DICT) {
    if (entry.toLowerCase() === q) return entry
    // 匹配括号里的别名或括号外的主名
    const parts = entry.replace(/[（）()]/g, ' ').split(/\s+/)
    for (const p of parts) {
      if (p && p.toLowerCase() === q) return entry
    }
  }
  // 包含匹配（用户输入是字典条目的一部分）
  for (const entry of IP_DICT) {
    if (entry.toLowerCase().indexOf(q) >= 0) return entry
  }
  return null
}
