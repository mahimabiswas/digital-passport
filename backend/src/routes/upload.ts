// import { Router, Request, Response } from 'express'
// import multer from 'multer'
// import { v2 as cloudinary } from 'cloudinary'

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// })

// const router = Router()

// const storage = multer.memoryStorage()

// const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
//   const allowed = ['image/jpeg', 'image/png', 'image/webp']
//   if (allowed.includes(file.mimetype)) {
//     cb(null, true)
//   } else {
//     cb(new Error('Only JPEG, PNG and WebP images are allowed'))
//   }
// }

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 },
// })

// router.post('/', upload.single('image'), async (req: Request, res: Response) => {
//   if (!req.file) {
//     res.status(400).json({ error: 'No file uploaded' })
//     return
//   }

//   try {
//     const result = await new Promise<any>((resolve, reject) => {
//       cloudinary.uploader.upload_stream(
//         { folder: 'digital-passport' },
//         (error: any, result: any) => {
//           if (error) reject(error)
//           else resolve(result)
//         }
//       ).end(req.file!.buffer)
//     })

//     res.status(201).json({ imageUrl: result.secure_url })
//   } catch (err: any) {
//     res.status(500).json({ error: 'Image upload failed', details: err.message })
//   }
// })

// export default router
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { PinataSDK } from 'pinata'

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY!,
})

const router = Router()

const storage = multer.memoryStorage()

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Only JPEG, PNG and WebP images are allowed'))
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
})

router.post('/', upload.single('image'), async (req: Request, res: Response) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' })
        return
    }

    try {
        const file = new File(
            [new Uint8Array(req.file.buffer)],
            req.file.originalname,
            { type: req.file.mimetype }
        )

        const upload = await pinata.upload.public.file(file)
        const imageUrl = await pinata.gateways.public.convert(upload.cid)

        res.status(201).json({ imageUrl })
    } catch (err: any) {
        res.status(500).json({ error: 'Image upload failed', details: err.message })
    }
})

export default router