const  express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { configDotenv } = require('dotenv');
const port = process.env.PORT || 3000;


app.use(cors({
	origin: ["http://localhost:5173",
		"http://localhost:5175",
	"https://al-madina-foods.web.app",
	"https://al-madina-foods.firebaseapp.com"
],
	credentials: true
}))
app.use(cookieParser())
app.use(express.json())



const verifyToken =(req,res,next)=> {
	const token = req.cookies?.token;
	if(!token){
		 return res.status(401).send({message: "unauthorized access"})
	}
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode)=> {
		if(err){
			return  res.status(401).send({message: "unauthorized access"})
		}
		req.user = decode;
		next()
	})
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3jtn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

	const foodCollection = client.db("FoodsCollection").collection("foods");
	const userCollection = client.db("FoodUsersDB").collection('users')
	
	// const requestedFoodCollection = client.db("requestedFoodDB").collection("requestedFood")

	// jwt related api=====
	app.post('/jwt', async(req,res)=>{

		const user = req.body;
		const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
			expiresIn: "1h"
		})
		res.cookie("token", token,  {
			httpOnly:true,
			secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

		}).send({success: true})
	})

	app.post('/logout', async(req,res)=> {
	res.clearCookie("token",{
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

	}).send({success: true})
	})


	app.get('/foods', async(req, res) => {
		const food = req.body;
		const result = await foodCollection.find(food).toArray();
		res.send(result)

		
	})
	app.get("/food-details/:id",async(req, res)=> {
		const foodId = req.params.id;
		const query = {_id: new ObjectId(foodId)};
		const result = await foodCollection.findOne(query);
		res.send(result)
	})

	// app.get('/featured-foods',async(req, res) => {
	// 	// const food = req.body;
	// 	const result = await foodCollection.find().limit(6).toArray()
	// 	res.send(result)
	// })

	app.get('/featured-foods', async (req, res) => {
			const result = await foodCollection
				.aggregate([
					{ 
						$addFields: { 
							foodQuantityAsNumber: { $toInt: "$foodQuantity" }
						} 
					},
					{ 
						$sort: { 
							foodQuantityAsNumber: -1
						} 
					},
					{ 
						$limit: 6 
					},
					{ 
						$project: { 
							foodQuantityAsNumber: 0
						} 
					}
				])
				.toArray();
			res.send(result) 
  })

  app.get('/available-foods', async (req, res) => {
    const query = { "foodUser.foodStatus": "available" };
    const result = await foodCollection.find(query).sort({ expireDate: 1 }).toArray();
    res.send(result);
});

	
app.get('/myRequest', verifyToken, async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) {
            return res.status(400).send({ message: "User email is required." });
        }
        const query = { 
            "foodUser.foodStatus": "requested", 
            "requestedBy.userEmail": userEmail 
        };
        const result = await foodCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error fetching my requests:", error);
        res.status(500).send({ message: "Failed to fetch requests." });
    }
});

	app.get('/myRequest',verifyToken,async(req, res)=> {
		const {userEmail} = req.query;
		const result = await foodCollection.find({"foodUser.foodStatus" : "requested", "requestedBy.userEmail": userEmail}).toArray()
		// const result = await requestedFoodCollection.find({"requestedBy.userEmail": userEmail}).toArray()
		res.send(result)
	})

	app.get('/myFood',verifyToken,async(req,res) => {
		const {userEmail} = req.query;
		const query = {"foodUser.donatorEmail": userEmail}
		const result = await foodCollection.find(query).toArray();
		res.send(result)
	})



	app.get('/recent-foods', async (req, res) => {
		  const recentFoods = await foodCollection.find().sort({ expireDate: -1 }).limit(5).toArray()
		  res.send(recentFoods)

		  
		  
	  });
	  app.get('/donor-stats/all', async (req, res) => {
		try {
		  const allDonors = await foodCollection.aggregate([
			{
			  $group: {
				_id: "$foodUser.donatorEmail",
				totalDonations: { $sum: 1 },
			  },
			},
			{ $sort: { totalDonations: -1 } }, 
		  ]).toArray();
	  
		  res.send(allDonors);
		} catch (error) {
		  console.error("Error fetching all donor stats:", error);
		  res.status(500).send({ message: "Failed to fetch all donor stats" });
		}
	  });
	  
	  
	  

	app.patch('/myFood/:foodId',verifyToken,async(req,res)=> {
		const  id = req.params.foodId;
	
		const query = {_id: new ObjectId(id)};
		
		const updatedFood = req.body;
		
		const updatedDoc = {
			$set: 
				updatedFood
			
		}
		const result= await foodCollection.updateOne(query, updatedDoc);
		res.send(result)

	})


	app.post('/add-foods',verifyToken ,async(req, res) => {
		const food = req.body;
		const result = await foodCollection.insertOne(food)
		res.send(result)
	})


	// API for food request=============

	app.post('/request-food', async (req, res) => {
		const {foodId, userEmail, requestDate, additionalNotes} =req.body;

		// const food = await foodCollection.findOne({_id: new ObjectId(foodId)})
		const query = {_id: new ObjectId(foodId), "foodUser.foodStatus": "available"}
		// const query = {_id: new ObjectId(foodId)}
		const result = await foodCollection.updateOne(query, {
			$set: {
				"foodUser.foodStatus":"requested",
				requestedBy: {
					userEmail, requestDate, additionalNotes
				},
			}
		})

		// const requestedFood = { ...food, requestedBy: {

		res.send(result)
	})


	// app.post('/request-food', verifyToken, async (req, res) => {
	// 	const { foodId, userEmail, requestDate, additionalNotes } = req.body;
	
	// 	try {
	// 		const query = { _id: new ObjectId(foodId), "foodUser.foodStatus": "available" };
	// 		const update = {
	// 			$set: {
	// 				"foodUser.foodStatus": "requested",
	// 				requestedBy: {
	// 					userEmail,
	// 					requestDate,
	// 					additionalNotes
	// 				},
	// 			}
	// 		};
	
	// 		const result = await foodCollection.updateOne(query, update);
	
	// 		if (result.matchedCount === 0) {
	// 			return res.status(404).send({ message: "Food not found or already requested." });
	// 		}
	
	// 		res.send({ success: true, message: "Food requested successfully." });
	// 	} catch (error) {
	// 		console.error("Error requesting food:", error);
	// 		res.status(500).send({ message: "Failed to request food." });
	// 	}
	// });
	

	app.delete('/myFood/:foodId', verifyToken, async (req,res) => {
		const id = req.params.foodId;
		const query = {_id: new ObjectId(id)}
		const result = await foodCollection.deleteOne(query)
		res.send(result)

	})

	// app.put('/food/:id', async(req, res) => {

	// })


	// user related APIs

	app.get('/users', async(req,res) => {
		
		const result = await userCollection.find().toArray()
		res.send(result)
	})

	app.post('/user', async(req,res) => {
		const user = req.body;
		console.log(user)
		const result = await userCollection.insertOne(user)
		res.send(result);
	})
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
	res.send("food server is running")
})

app.listen(port, ()=> {
	console.log(`server is running on port : ${port}`)
})