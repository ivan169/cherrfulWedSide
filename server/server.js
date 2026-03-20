import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MongoClient, ObjectId } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 4000;

// MongoDB 配置
const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'cheerful_db';

let db = null;

// MongoDB 连接
async function connectMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    
    console.log('✓ MongoDB 连接成功');
    
    // 初始化数据库和集合
    await initializeDatabase();
    
    return client;
  } catch (error) {
    console.error('✗ MongoDB 连接失败:', error.message);
    console.log('请确保 MongoDB 已安装并运行：');
    console.log('  Windows: mongod');
    console.log('  或使用包管理器安装：npm install -g mongodb');
    process.exit(1);
  }
}

// 初始化数据库和默认数据
async function initializeDatabase() {
  try {
    // 创建集合
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // 创建 categories 集合和默认数据
    if (!collectionNames.includes('categories')) {
      await db.createCollection('categories');
      const defaultCategories = [
        { id: 1, name: '瓷砖', enName: 'Tiles', swName: 'Mabati', createdAt: new Date().toISOString() },
        { id: 2, name: '卫浴', enName: 'Sanitary Ware', swName: 'Sanitary', createdAt: new Date().toISOString() },
        { id: 3, name: '灯饰', enName: 'Lighting Fixtures', swName: 'Mwangaza', createdAt: new Date().toISOString() }
      ];
      await db.collection('categories').insertMany(defaultCategories);
      console.log('✓ 默认分类已创建');
    }

    // 创建 users 集合和默认数据
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
      const defaultUsers = [
        { id: 1, username: 'admin', password: 'admin', name: '管理员' }
      ];
      await db.collection('users').insertMany(defaultUsers);
      console.log('✓ 默认用户已创建');
    }

    // 创建 products 集合
    if (!collectionNames.includes('products')) {
      await db.createCollection('products');
      console.log('✓ 产品集合已创建');
    }

    // 创建 contacts 集合
    if (!collectionNames.includes('contacts')) {
      await db.createCollection('contacts');
      console.log('✓ 联系集合已创建');
    }

    // 创建 team_members 集合
    if (!collectionNames.includes('team_members')) {
      await db.createCollection('team_members');
      console.log('✓ 团队成员集合已创建');
    }

    // 创建 company_info 集合
    if (!collectionNames.includes('company_info')) {
      await db.createCollection('company_info');
      console.log('✓ 公司信息集合已创建');
    }

  } catch (error) {
    console.error('初始化数据库失败:', error.message);
  }
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
// 配置静态文件服务，使上传的图片可以被访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 配置静态文件服务，使图片可以被访问
app.use('/images', express.static(path.join(__dirname, '..', 'images')));

// 创建上传目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 单个文件最大100MB
    files: 80 // 最多80个文件（40张主图 + 40张介绍图）
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传图片文件'));
    }
  }
});

// 产品多字段上传（主图 + 图文介绍图片）
const uploadProductFields = upload.fields([
  { name: 'images', maxCount: 40 },      // 每个字段最多40张
  { name: 'introImages', maxCount: 40 }  // 每个字段最多40张
]);

// 团队成员单图上传
const uploadTeamMemberImage = upload.single('image');

// 验证 MongoDB 连接中间件
function checkDatabase(req, res, next) {
  if (!db) {
    return res.status(503).json({ success: false, message: '数据库连接失败' });
  }
  next();
}

app.use(checkDatabase);

// ==================== 认证中间件 ====================

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '未提供授权令牌' });
  }
  req.token = token;
  next();
}

// ==================== 认证接口 ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const user = await db.collection('users').findOne({ 
      username: username, 
      password: password 
    });

    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const token = 'token_' + uuidv4();
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// ==================== 分类接口 ====================

// 获取所有分类
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.collection('categories')
      .find({})
      .sort({ id: 1 })
      .toArray();
    
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({ success: false, message: '获取分类列表失败' });
  }
});

// 获取单个分类
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.collection('categories')
      .findOne({ id: parseInt(id) });

    if (!category) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败' });
  }
});

// 添加分类
app.post('/api/categories', async (req, res) => {
  try {
    const { name, enName, swName } = req.body;

    if (!name || !enName || !swName) {
      return res.status(400).json({ success: false, message: '分类名称不能为空' });
    }

    // 获取最大ID
    const maxCategory = await db.collection('categories')
      .findOne({}, { sort: { id: -1 } });
    
    const newId = maxCategory ? maxCategory.id + 1 : 1;

    const newCategory = {
      id: newId,
      name,
      enName,
      swName,
      createdAt: new Date().toISOString()
    };

    const result = await db.collection('categories').insertOne(newCategory);

    res.json({ success: true, message: '分类添加成功', data: newCategory });
  } catch (error) {
    console.error('添加分类失败:', error);
    res.status(500).json({ success: false, message: '添加分类失败' });
  }
});

// 编辑分类
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, enName, swName } = req.body;

    const result = await db.collection('categories').updateOne(
      { id: parseInt(id) },
      {
        $set: {
          name,
          enName,
          swName,
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    const updatedCategory = await db.collection('categories')
      .findOne({ id: parseInt(id) });

    res.json({ success: true, message: '分类编辑成功', data: updatedCategory });
  } catch (error) {
    console.error('编辑分类失败:', error);
    res.status(500).json({ success: false, message: '编辑分类失败' });
  }
});

// 删除分类
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await db.collection('products')
      .findOne({ categoryId: parseInt(id) });

    if (product) {
      return res.status(400).json({ 
        success: false, 
        message: '该分类下还有产品，无法删除' 
      });
    }

    const result = await db.collection('categories').deleteOne({ id: parseInt(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    res.status(500).json({ success: false, message: '删除分类失败' });
  }
});

// ==================== 产品接口 ====================

// 获取所有产品
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.collection('products')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({ success: false, message: '获取产品列表失败' });
  }
});

// 获取单个产品详情
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.collection('products').findOne({ id: id });

    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('获取产品失败:', error);
    res.status(500).json({ success: false, message: '获取产品失败' });
  }
});

// 按分类获取产品
app.get('/api/categories/:categoryId/products', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const products = await db.collection('products')
      .find({ categoryId: parseInt(categoryId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('获取分类产品失败:', error);
    res.status(500).json({ success: false, message: '获取分类产品失败' });
  }
});

// 搜索产品
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    let query = {};
    if (q) {
      query = {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { enName: { $regex: q, $options: 'i' } },
          { desc: { $regex: q, $options: 'i' } },
          { enDesc: { $regex: q, $options: 'i' } },
          { swDesc: { $regex: q, $options: 'i' } }
        ]
      };
    }

    const products = await db.collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('搜索产品失败:', error);
    res.status(500).json({ success: false, message: '搜索产品失败' });
  }
});

// Multer 错误处理包装函数
function handleMulterUpload(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error('Multer 错误:', err);
        console.error('错误代码:', err.code);
        console.error('错误字段:', err.field);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: '文件大小超过限制（单个文件最大100MB）' });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ success: false, message: '文件总数超过限制（最多80个文件）' });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          const fieldName = err.field === 'images' ? '产品主图' : err.field === 'introImages' ? '介绍图片' : err.field;
          return res.status(400).json({ 
            success: false, 
            message: `${fieldName}字段的文件数量超过限制（每个字段最多40张图片）` 
          });
        } else {
          return res.status(400).json({ success: false, message: `上传错误: ${err.message}` });
        }
      }
      next();
    });
  };
}

// 添加产品
app.post('/api/products', handleMulterUpload(uploadProductFields), async (req, res) => {
  try {
    // 调试日志：查看接收到的文件字段
    console.log('接收到的文件字段:', req.files ? Object.keys(req.files) : 'none');
    console.log('images数量:', req.files && req.files.images ? req.files.images.length : 0);
    console.log('introImages数量:', req.files && req.files.introImages ? req.files.introImages.length : 0);
    
    const { name, enName, swName, categoryId, price, desc, enDesc, swDesc, introText, introTextEn, introTextSw } = req.body;

    if (!name || !enName || !swName || !categoryId) {
      if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
      if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: '必填字段不能为空' });
    }

    const priceText = price !== undefined && price !== null ? String(price).trim() : '';
    let parsedPrice = null;
    if (priceText !== '') {
      parsedPrice = parseFloat(priceText);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
        if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
        return res.status(400).json({ success: false, message: '价格必须是大于等于0的数字' });
      }
    }

    const images = (req.files && req.files.images)
      ? req.files.images.map(f => `/uploads/${f.filename}`)
      : [];
    const introImages = (req.files && req.files.introImages)
      ? req.files.introImages.map(f => `/uploads/${f.filename}`)
      : [];

    const newProduct = {
      id: uuidv4(),
      name,
      enName,
      swName,
      categoryId: parseInt(categoryId),
      price: parsedPrice,
      desc: desc || '',
      enDesc: enDesc || '',
      swDesc: swDesc || '',
      images,
      imageUrl: images.length > 0 ? images[0] : null,
      introImages,
      introText: introText || '',
      introTextEn: introTextEn || '',
      introTextSw: introTextSw || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('products').insertOne(newProduct);

    res.json({ success: true, message: '产品添加成功', data: newProduct });
  } catch (error) {
    if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
    if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
    console.error('添加产品失败:', error);
    res.status(500).json({ success: false, message: '添加产品失败' });
  }
});

// 编辑产品
app.put('/api/products/:id', handleMulterUpload(uploadProductFields), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, enName, swName, categoryId, price, desc, enDesc, swDesc, introText, introTextEn, introTextSw, existingImages, existingIntroImages } = req.body;

    if (!name || !enName || !swName || !categoryId) {
      if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
      if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: '必填字段不能为空' });
    }

    const product = await db.collection('products').findOne({ id: id });

    if (!product) {
      if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
      if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
      return res.status(404).json({ success: false, message: '产品不存在' });
    }

    const priceText = price !== undefined && price !== null ? String(price).trim() : '';
    let parsedPrice = null;
    if (priceText !== '') {
      parsedPrice = parseFloat(priceText);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        if (req.files && req.files.images) req.files.images.forEach(f => fs.unlinkSync(f.path));
        if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
        return res.status(400).json({ success: false, message: '价格必须是大于等于0的数字' });
      }
    }

    // 处理产品主图：保留现有图片（按新顺序）+ 新上传的图片
    const oldImages = product.images || (product.imageUrl ? [product.imageUrl] : []);
    let keepImageUrls = [];
    try {
      keepImageUrls = existingImages ? JSON.parse(existingImages) : [];
    } catch (e) {
      keepImageUrls = [];
    }
    // 删除不在保留列表中的图片文件
    oldImages.forEach(imgUrl => {
      if (!keepImageUrls.includes(imgUrl) && imgUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, 'uploads', path.basename(imgUrl));
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log('已删除图片:', filePath);
          } catch (err) {
            console.error('删除图片失败:', err);
          }
        }
      }
    });
    // 组合图片列表：保留的现有图片 + 新上传的图片
    let images = [...keepImageUrls];
    if (req.files && req.files.images && req.files.images.length > 0) {
      images = images.concat(req.files.images.map(f => `/uploads/${f.filename}`));
    }

    // 处理图文介绍图片：保留现有图片（按新顺序）+ 新上传的图片
    const oldIntroImages = product.introImages || [];
    let keepIntroUrls = [];
    try {
      keepIntroUrls = existingIntroImages ? JSON.parse(existingIntroImages) : [];
    } catch (e) {
      keepIntroUrls = [];
    }
    // 删除不在保留列表中的介绍图片文件
    oldIntroImages.forEach(imgUrl => {
      if (!keepIntroUrls.includes(imgUrl) && imgUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, 'uploads', path.basename(imgUrl));
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log('已删除介绍图片:', filePath);
          } catch (err) {
            console.error('删除介绍图片失败:', err);
          }
        }
      }
    });
    // 组合介绍图片列表：保留的现有图片 + 新上传的图片
    let introImages = [...keepIntroUrls];
    if (req.files && req.files.introImages && req.files.introImages.length > 0) {
      introImages = introImages.concat(req.files.introImages.map(f => `/uploads/${f.filename}`));
    }

    const updateData = {
      name,
      enName,
      swName,
      categoryId: parseInt(categoryId),
      price: parsedPrice,
      desc: desc || '',
      enDesc: enDesc || '',
      swDesc: swDesc || '',
      images,
      imageUrl: images.length > 0 ? images[0] : null,
      introImages,
      introText: introText !== undefined ? introText : (product.introText || ''),
      introTextEn: introTextEn !== undefined ? introTextEn : (product.introTextEn || ''),
      introTextSw: introTextSw !== undefined ? introTextSw : (product.introTextSw || ''),
      updatedAt: new Date().toISOString()
    };

    await db.collection('products').updateOne(
      { id: id },
      { $set: updateData }
    );

    const updatedProduct = await db.collection('products').findOne({ id: id });

    res.json({ success: true, message: '产品编辑成功', data: updatedProduct });
  } catch (error) {
    if (req.files && req.files.image) fs.unlinkSync(req.files.image[0].path);
    if (req.files && req.files.introImages) req.files.introImages.forEach(f => fs.unlinkSync(f.path));
    console.error('编辑产品失败:', error);
    res.status(500).json({ success: false, message: '编辑产品失败' });
  }
});

// 删除产品
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await db.collection('products').findOne({ id: id });

    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }

    // 删除主图片文件
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(imgUrl => {
        if (imgUrl && imgUrl.startsWith('/uploads/')) {
          const imagePath = path.join(__dirname, 'uploads', path.basename(imgUrl));
          if (fs.existsSync(imagePath)) {
            try {
              fs.unlinkSync(imagePath);
              console.log('已删除主图:', imagePath);
            } catch (err) {
              console.error('删除主图失败:', err);
            }
          }
        }
      });
    } else if (product.imageUrl && product.imageUrl.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, 'uploads', path.basename(product.imageUrl));
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log('已删除主图:', imagePath);
        } catch (err) {
          console.error('删除主图失败:', err);
        }
      }
    }

    // 删除图文介绍图片
    if (product.introImages && Array.isArray(product.introImages)) {
      product.introImages.forEach(imgUrl => {
        if (imgUrl && imgUrl.startsWith('/uploads/')) {
          const imgPath = path.join(__dirname, 'uploads', path.basename(imgUrl));
          if (fs.existsSync(imgPath)) {
            try {
              fs.unlinkSync(imgPath);
              console.log('已删除介绍图:', imgPath);
            } catch (err) {
              console.error('删除介绍图失败:', err);
            }
          }
        }
      });
    }

    // 删除数据库记录
    await db.collection('products').deleteOne({ id: id });

    res.json({ success: true, message: '产品删除成功' });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({ success: false, message: '删除产品失败' });
  }
});

// ==================== 联系表单接口 ====================

// 获取所有联系消息（管理）
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await db.collection('contacts')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('获取联系消息失败:', error);
    res.status(500).json({ success: false, message: '获取联系消息失败' });
  }
});

// 获取单个联系消息
app.get('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await db.collection('contacts').findOne({ id: id });

    if (!contact) {
      return res.status(404).json({ success: false, message: '联系消息不存在' });
    }

    // 标记为已读
    await db.collection('contacts').updateOne(
      { id: id },
      { $set: { isRead: true } }
    );

    // 重新获取更新后的联系消息
    const updatedContact = await db.collection('contacts').findOne({ id: id });
    res.json({ success: true, data: updatedContact });
  } catch (error) {
    console.error('获取联系消息失败:', error);
    res.status(500).json({ success: false, message: '获取联系消息失败' });
  }
});

// 提交联系表单
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ success: false, message: '所有字段都是必需的' });
    }

    const contact = {
      id: uuidv4(),
      name,
      email,
      phone,
      message,
      isRead: false,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    await db.collection('contacts').insertOne(contact);

    res.json({ success: true, message: '您的邮件已成功发送', data: contact });
  } catch (error) {
    console.error('提交联系表单失败:', error);
    res.status(500).json({ success: false, message: '提交表单失败' });
  }
});

// 更新联系消息状态
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isRead } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (isRead !== undefined) updateData.isRead = isRead;

    const result = await db.collection('contacts').updateOne(
      { id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: '联系消息不存在' });
    }

    const contact = await db.collection('contacts').findOne({ id: id });
    res.json({ success: true, message: '联系消息已更新', data: contact });
  } catch (error) {
    console.error('更新联系消息失败:', error);
    res.status(500).json({ success: false, message: '更新联系消息失败' });
  }
});

// 删除联系消息
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.collection('contacts').deleteOne({ id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: '联系消息不存在' });
    }

    res.json({ success: true, message: '联系消息已删除' });
  } catch (error) {
    console.error('删除联系消息失败:', error);
    res.status(500).json({ success: false, message: '删除联系消息失败' });
  }
});

// ==================== 团队成员接口 ====================

// 获取所有团队成员
app.get('/api/team-members', async (req, res) => {
  try {
    const members = await db.collection('team_members')
      .find({})
      .sort({ order: 1 })
      .toArray();
    
    res.json({ success: true, data: members });
  } catch (error) {
    console.error('获取团队成员失败:', error);
    res.status(500).json({ success: false, message: '获取团队成员失败' });
  }
});

// 获取单个团队成员
app.get('/api/team-members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const member = await db.collection('team_members').findOne({ id: id });

    if (!member) {
      return res.status(404).json({ success: false, message: '团队成员不存在' });
    }

    res.json({ success: true, data: member });
  } catch (error) {
    console.error('获取团队成员失败:', error);
    res.status(500).json({ success: false, message: '获取团队成员失败' });
  }
});

// 添加团队成员
app.post('/api/team-members', handleMulterUpload(uploadTeamMemberImage), async (req, res) => {
  try {
    const { name, enName, swName, role, enRole, swRole, desc, enDesc, swDesc, imageUrl } = req.body;

    if (!name || !enName || !swName || !role || !enRole || !swRole) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: '必填字段不能为空' });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : (imageUrl || '');
    const maxMember = await db.collection('team_members')
      .findOne({}, { sort: { order: -1 } });
    const order = maxMember ? maxMember.order + 1 : 1;

    const newMember = {
      id: uuidv4(),
      name,
      enName,
      swName,
      role,
      enRole,
      swRole,
      desc: desc || '',
      enDesc: enDesc || '',
      swDesc: swDesc || '',
      image,
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('team_members').insertOne(newMember);
    res.json({ success: true, message: '团队成员添加成功', data: newMember });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('添加团队成员失败:', error);
    res.status(500).json({ success: false, message: '添加团队成员失败' });
  }
});

// 编辑团队成员
app.put('/api/team-members/:id', handleMulterUpload(uploadTeamMemberImage), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, enName, swName, role, enRole, swRole, desc, enDesc, swDesc, imageUrl } = req.body;

    if (!name || !enName || !swName || !role || !enRole || !swRole) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: '必填字段不能为空' });
    }

    const member = await db.collection('team_members').findOne({ id: id });
    if (!member) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: '团队成员不存在' });
    }

    // 处理图片
    let image = member.image;
    if (req.file) {
      if (member.image && member.image.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, 'uploads', path.basename(member.image));
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
      image = `/uploads/${req.file.filename}`;
    } else if (imageUrl) {
      image = imageUrl;
    }

    const updateData = {
      name, enName, swName, role, enRole, swRole,
      desc: desc || '', enDesc: enDesc || '', swDesc: swDesc || '',
      image,
      updatedAt: new Date().toISOString()
    };

    await db.collection('team_members').updateOne({ id: id }, { $set: updateData });
    const updatedMember = await db.collection('team_members').findOne({ id: id });
    res.json({ success: true, message: '团队成员已更新', data: updatedMember });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('编辑团队成员失败:', error);
    res.status(500).json({ success: false, message: '编辑团队成员失败' });
  }
});

// 删除团队成员
app.delete('/api/team-members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const member = await db.collection('team_members').findOne({ id: id });

    if (!member) {
      return res.status(404).json({ success: false, message: '团队成员不存在' });
    }

    // 删除图片
    if (member.image && member.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, 'uploads', path.basename(member.image));
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await db.collection('team_members').deleteOne({ id: id });
    res.json({ success: true, message: '团队成员已删除' });
  } catch (error) {
    console.error('删除团队成员失败:', error);
    res.status(500).json({ success: false, message: '删除团队成员失败' });
  }
});

// ==================== 公司信息接口 ====================

// 获取公司信息
app.get('/api/company-info', async (req, res) => {
  try {
    let companyInfo = await db.collection('company_info').findOne({});
    
    if (!companyInfo) {
      // 初始化默认公司信息
      companyInfo = {
        id: 'company_info',
        desc1_en: 'CHEERFUL Africa is a leading supplier of premium building materials and home solutions in East Africa.',
        desc1_sw: 'CHEERFUL Africa ni mtoa mwenye uwezo wa bidhaa za ujenzi za kiwango cha juu.',
        desc1_zh: 'CHEERFUL Africa 是东非优质建筑材料和家居解决方案的领先供应商。',
        desc2_en: 'With over 13 years of industry experience, we have built a reputation for quality products.',
        desc2_sw: 'Na uzoefu wa miaka 13+ ya kiuchumi, tumejenga sifa ya ubora.',
        desc2_zh: '凭借 13 年以上的行业经验，我们建立了产品质量的声誉。',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.collection('company_info').insertOne(companyInfo);
    }
    
    res.json({ success: true, data: companyInfo });
  } catch (error) {
    console.error('获取公司信息失败:', error);
    res.status(500).json({ success: false, message: '获取公司信息失败' });
  }
});

// 编辑公司信息
app.put('/api/company-info', async (req, res) => {
  try {
    const { desc1_en, desc1_sw, desc1_zh, desc2_en, desc2_sw, desc2_zh } = req.body;

    const updateData = {
      desc1_en: desc1_en || '',
      desc1_sw: desc1_sw || '',
      desc1_zh: desc1_zh || '',
      desc2_en: desc2_en || '',
      desc2_sw: desc2_sw || '',
      desc2_zh: desc2_zh || '',
      updatedAt: new Date().toISOString()
    };

    await db.collection('company_info').updateOne(
      { id: 'company_info' },
      { $set: updateData },
      { upsert: true }
    );

    const companyInfo = await db.collection('company_info').findOne({ id: 'company_info' });
    res.json({ success: true, message: '公司信息已更新', data: companyInfo });
  } catch (error) {
    console.error('编辑公司信息失败:', error);
    res.status(500).json({ success: false, message: '编辑公司信息失败' });
  }
});

// ==================== 统计接口 ====================

// 获取统计数据
app.get('/api/stats', async (req, res) => {
  try {
    const totalProducts = await db.collection('products').countDocuments();
    const totalCategories = await db.collection('categories').countDocuments();
    const totalContacts = await db.collection('contacts').countDocuments();
    const unreadContacts = await db.collection('contacts').countDocuments({ isRead: false });
    const teamMembers = await db.collection('team_members').countDocuments();

    res.json({
      success: true,
      data: {
        totalProducts,
        totalCategories,
        totalContacts,
        unreadContacts,
        teamMembers,
        totalViews: 0,
        totalOrders: 0
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// ==================== 错误处理 ====================

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('错误:', err);
  const status = err.status || 500;
  const message = err.message || '服务器内部错误';
  res.status(status).json({ 
    success: false, 
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ==================== 启动服务器 ====================

// 连接 MongoDB 并启动服务器
connectMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✓ CHEERFUL 服务器运行在 http://localhost:${PORT}`);
    console.log(`✓ MongoDB 数据库已连接: ${MONGODB_URI}/${DATABASE_NAME}`);
    console.log(`✓ 公开文件目录: http://localhost:${PORT}`);
    console.log(`✓ 管理后台: http://localhost:${PORT}/admin.html\n`);
  });
});
