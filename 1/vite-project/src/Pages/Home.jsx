import React from 'react'
import Header from '../Components/Header/Header'
import Brand from '../Components/Brand/Brands'
import FeaturesBooks from '../Components/FeaturesBooks/FeaturesBooks'
import BestBook from '../Components/BestSellingBook/BestBook'
import PopularBook from '../Components/PopularBooks/PopularBook'
import Quote from '../Components/Quote/Quote'
import LatestArticle from '../Components/LatestArticle/LatestArticle'

export default function Home() {
  return (
    <>
    <Header/>
    <Brand/>
    <FeaturesBooks/>
    <BestBook/>
    <PopularBook/>
    <Quote/>
    <LatestArticle/>
    </>
  )
}
