const express = require('express')
const cors = require('cors')
require('dotenv').config();

const app = express()

app.use(cors())
app.use(express.json())
const port = process.env.PORT || 5000;



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oeipnk8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection

        const userCollection = client.db('Learnify').collection('users')
        const teacherRequestCollection = client.db('Learnify').collection('teacherRequest')
        const classCollection = client.db('Learnify').collection('classes')


        app.get('/users', async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = { email: req.query.email }
            }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        app.patch('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    role: req.body.role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.post('/teacherRequest', async (req, res) => {
            const request = req.body;
            const result = await teacherRequestCollection.insertOne(request)
            res.send(result)
        })

        app.patch('/teacherRequest/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await teacherRequestCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/teacherRequest', async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = { email: req.query.email }
            }
            const result = await teacherRequestCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/classes', async (req, res) => {
            const aClass = req.body;
            const result = await classCollection.insertOne(aClass)
            res.send(result)
        })

        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const doc = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: doc.status
                }
            }

            const result = await classCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('server is running....');
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`)
})