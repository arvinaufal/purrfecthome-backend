const { ObjectId } = require("mongodb");
const { getDB } = require("../config/mongo");

class Post {
    static async getByRadius({ long, lat }) {
        const postsCollection = getDB().collection("Posts");
        const nearbyPosts = await postsCollection.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [long, lat],
                    },
                    $maxDistance: 70000
                },
            },
        }).toArray();

        return nearbyPosts;
    }

    static async updateAdopter({ AdopterId, PostId }) {
        const postsCollection = getDB().collection("Posts");
        const updateAdopter = await postsCollection.updateOne(
            { _id: new ObjectId(PostId) },
            { $set: { AdopterId: new ObjectId(AdopterId) } } 
        );

        return updateAdopter;
    }

    static async create(name, size, age, breed, gender, color, statusPrice, description, photo, long, lat) {
        const newPost = {
            name,
            size, 
            age, 
            breed, 
            gender,
            color,
            status: "available",
            statusPrice,
            description,
            photo,
            adopterId: "",
            posterId,
            long,
            lat,
            accountType: "regular",
            createdAt: new Date(),
            updatedAt: new Date() 
        }

        const { insertedId } = await getDB().collection("Posts").insertOne(newPost)
        newPost.id = insertedId

        return newPost
    }
}

module.exports = Post;
