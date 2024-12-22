const  express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;


app.use(express.json())
app.use(cors())






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

	const foodCollection = client.db("FoodsCollection").collection("foods")

	app.get('/foods', async(req, res) => {
		const food = req.body;
		const result = await foodCollection.find(food).toArray();
		res.send(result)
	})

	// app.post('/foods', async(req, res) => {
	// 	const food = req.body;
	// 	const result = await foodCollection.insertOne(food)
	// 	res.send(result)
	// })

	// app.delete('/food/:foodId', async (req,res) => {
	// 	const id = req.params.foodId;
	// 	const query = {_id: new ObjectId(id)}
	// 	const result = await foodCollection.deleteOne(query)
	// 	res.send(result)

	// })

	// app.put('/food/:id', async(req, res) => {

	// })
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